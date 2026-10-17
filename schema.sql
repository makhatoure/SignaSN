-- ==============================================================================
-- SignaSN — Schéma Supabase & Règles RLS (Row Level Security)
-- Nettoyage préalable pour éviter les erreurs "type already exists"
-- ==============================================================================

-- 0. NETTOYAGE PRÉALABLE (Réinitialisation propre du schéma)
DROP VIEW IF EXISTS public.v_establishment_stats CASCADE;
DROP TABLE IF EXISTS public.comments CASCADE;
DROP TABLE IF EXISTS public.content_flags CASCADE;
DROP TABLE IF EXISTS public.report_interactions CASCADE;
DROP TABLE IF EXISTS public.reports CASCADE;
DROP TABLE IF EXISTS public.establishments CASCADE;
DROP TABLE IF EXISTS public.app_settings CASCADE;

DROP TYPE IF EXISTS report_category CASCADE;
DROP TYPE IF EXISTS report_status CASCADE;
DROP TYPE IF EXISTS reporter_role CASCADE;
DROP TYPE IF EXISTS interaction_type CASCADE;

-- Extensions requises
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. ENUMS
-- ==============================================================================

CREATE TYPE report_category AS ENUM (
    'insalubrite',       -- Insalubrité & bâtiments dangereux (immédiatement public avec photo)
    'voirie',            -- 🚧 Routes et voirie (immédiatement public, photo recommandée)
    'eau_electricite',   -- 💧 Eau et électricité (faits matériels public immédiatement, coupures après recoupement)
    'sante',             -- Santé (public après 3 signalements concordants)
    'mairies_services',  -- Mairies & services publics (public après recoupement)
    'securite'           -- Sécurité (agrégation par zones, jamais de récit brut)
);

CREATE TYPE report_status AS ENUM (
    'recu',              -- Enregistré, en attente de recoupement / modération
    'confirme',          -- Validé (soit auto par seuil concordant, soit modérateur)
    'transmis',          -- Transmis au service public ou autorité concernée
    'resolu'             -- Problème résolu sur le terrain
);

CREATE TYPE reporter_role AS ENUM (
    'present',           -- Présent sur les lieux
    'victime',           -- Directement impacté / victime
    'rapporte'           -- Fait constaté ou rapporté directement
);

CREATE TYPE interaction_type AS ENUM (
    'moi_aussi',         -- "Moi aussi j'ai vu"
    'important',         -- "Important"
    'resolu'             -- "Résolu" (constat de résolution sur place)
);

-- ==============================================================================
-- 2. TABLE DES ÉTABLISSEMENTS PUBLICS (Liste fermée de référence)
-- ==============================================================================

CREATE TABLE public.establishments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- 'hopital', 'centre_sante', 'mairie', 'service_public'
    region TEXT NOT NULL DEFAULT 'Dakar',
    department TEXT NOT NULL DEFAULT 'Dakar',
    commune TEXT NOT NULL,
    address TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_establishments_commune ON public.establishments(commune);
CREATE INDEX idx_establishments_category ON public.establishments(category);

-- ==============================================================================
-- 3. TABLE PRINCIPALE DES SIGNALEMENTS (reports)
-- ==============================================================================

CREATE TABLE public.reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    category report_category NOT NULL,
    status report_status NOT NULL DEFAULT 'recu',
    
    establishment_id UUID REFERENCES public.establishments(id) ON DELETE SET NULL,
    service_name TEXT,
    
    location_name TEXT NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    region TEXT NOT NULL DEFAULT 'Dakar',
    
    incident_date DATE NOT NULL DEFAULT CURRENT_DATE,
    incident_time TIME WITHOUT TIME ZONE,
    moment_of_day TEXT,
    
    fact_type TEXT NOT NULL, 
    waiting_time_minutes INTEGER,
    immediate_danger BOOLEAN DEFAULT false,
    people_involved_count INTEGER,
    
    factual_description VARCHAR(500) NOT NULL,
    photo_url TEXT,
    reporter_role reporter_role NOT NULL DEFAULT 'present',
    
    device_fingerprint TEXT NOT NULL,
    is_publicly_visible BOOLEAN NOT NULL DEFAULT false,
    flagged_for_review BOOLEAN NOT NULL DEFAULT false,
    review_reason TEXT,
    
    moi_aussi_count INTEGER NOT NULL DEFAULT 0,
    important_count INTEGER NOT NULL DEFAULT 0,
    resolu_count INTEGER NOT NULL DEFAULT 0,
    
    admin_notes TEXT,
    right_of_reply_text TEXT,
    right_of_reply_date TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reports_category_status ON public.reports(category, status, is_publicly_visible);
CREATE INDEX idx_reports_establishment ON public.reports(establishment_id);
CREATE INDEX idx_reports_created_at ON public.reports(created_at DESC);
CREATE INDEX idx_reports_device ON public.reports(device_fingerprint, created_at);

-- ==============================================================================
-- 4. INTERACTIONS PRÉDÉFINIES (Moi aussi, Important, Résolu)
-- ==============================================================================

CREATE TABLE public.report_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
    interaction interaction_type NOT NULL,
    device_fingerprint TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_interaction_per_device UNIQUE (report_id, interaction, device_fingerprint)
);

CREATE INDEX idx_interactions_report ON public.report_interactions(report_id);

CREATE OR REPLACE FUNCTION update_report_interaction_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF NEW.interaction = 'moi_aussi' THEN
            UPDATE public.reports SET moi_aussi_count = moi_aussi_count + 1 WHERE id = NEW.report_id;
        ELSIF NEW.interaction = 'important' THEN
            UPDATE public.reports SET important_count = important_count + 1 WHERE id = NEW.report_id;
        ELSIF NEW.interaction = 'resolu' THEN
            UPDATE public.reports SET resolu_count = resolu_count + 1 WHERE id = NEW.report_id;
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        IF OLD.interaction = 'moi_aussi' THEN
            UPDATE public.reports SET moi_aussi_count = GREATEST(0, moi_aussi_count - 1) WHERE id = OLD.report_id;
        ELSIF OLD.interaction = 'important' THEN
            UPDATE public.reports SET important_count = GREATEST(0, important_count - 1) WHERE id = OLD.report_id;
        ELSIF OLD.interaction = 'resolu' THEN
            UPDATE public.reports SET resolu_count = GREATEST(0, resolu_count - 1) WHERE id = OLD.report_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_report_interaction_counts
AFTER INSERT OR DELETE ON public.report_interactions
FOR EACH ROW EXECUTE FUNCTION update_report_interaction_counts();

-- ==============================================================================
-- 5. SIGNALEMENT DE CONTENU (Retrait sous 24-48h)
-- ==============================================================================

CREATE TABLE public.content_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    details TEXT,
    reporter_device TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'en_attente',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- ==============================================================================
-- 6. PHASE ULTÉRIEURE : PARAMÈTRES & COMMENTAIRES (Désactivés en V1)
-- ==============================================================================

CREATE TABLE public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.app_settings (key, value)
VALUES ('features', '{"comments_enabled": false, "moderation_strict": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE public.comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
    author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    author_display_name TEXT NOT NULL DEFAULT 'Citoyen',
    content VARCHAR(200) NOT NULL,
    is_approved BOOLEAN NOT NULL DEFAULT false,
    is_closed_by_admin BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 7. LOGIQUE DE VISIBILITÉ FACTUELLE (Triggers)
-- ==============================================================================

CREATE OR REPLACE FUNCTION evaluate_report_visibility()
RETURNS TRIGGER AS $$
DECLARE
    concordant_count INTEGER;
BEGIN
    IF NEW.flagged_for_review THEN
        NEW.is_publicly_visible := false;
        RETURN NEW;
    END IF;

    -- Insalubrité : visible immédiatement
    IF NEW.category = 'insalubrite' THEN
        NEW.is_publicly_visible := true;
        IF NEW.status = 'recu' THEN
            NEW.status := 'confirme';
        END IF;
        RETURN NEW;
    END IF;

    -- 6. Voirie : visible immédiatement (faits matériels, risque faible)
    IF NEW.category = 'voirie' THEN
        NEW.is_publicly_visible := true;
        IF NEW.status = 'recu' THEN
            NEW.status := 'confirme';
        END IF;
        RETURN NEW;
    END IF;

    -- 7. Eau et électricité : 
    -- Visible immédiatement pour les faits matériels (fuite, poteau penché, câble dénudé, danger immédiat)
    -- Recoupement requis pour les coupures d'eau/électricité
    IF NEW.category = 'eau_electricite' THEN
        IF NEW.immediate_danger OR NEW.fact_type IN ('fuite_eau', 'poteau_cable_dangereux', 'borne_compteur_hors_service', 'eau_non_potable') THEN
            NEW.is_publicly_visible := true;
            IF NEW.status = 'recu' THEN
                NEW.status := 'confirme';
            END IF;
            RETURN NEW;
        ELSE
            -- Coupures d'eau ou électricité : public dès 3 signalements concordants dans le secteur
            SELECT COUNT(*) INTO concordant_count
            FROM public.reports
            WHERE category = 'eau_electricite'
              AND location_name = NEW.location_name
              AND fact_type = NEW.fact_type
              AND created_at >= NOW() - INTERVAL '7 days';

            IF (concordant_count + 1) >= 3 THEN
                NEW.is_publicly_visible := true;
                NEW.status := 'confirme';
                UPDATE public.reports
                SET is_publicly_visible = true, status = 'confirme'
                WHERE category = 'eau_electricite'
                  AND location_name = NEW.location_name
                  AND fact_type = NEW.fact_type
                  AND created_at >= NOW() - INTERVAL '7 days'
                  AND is_publicly_visible = false;
            ELSE
                NEW.is_publicly_visible := false;
                NEW.status := 'recu';
            END IF;
            RETURN NEW;
        END IF;
    END IF;

    -- Santé : visible dès 3 signalements concordants
    IF NEW.category = 'sante' AND NEW.establishment_id IS NOT NULL THEN
        SELECT COUNT(*) INTO concordant_count
        FROM public.reports
        WHERE category = 'sante'
          AND establishment_id = NEW.establishment_id
          AND fact_type = NEW.fact_type
          AND created_at >= NOW() - INTERVAL '30 days';

        IF (concordant_count + 1) >= 3 THEN
            NEW.is_publicly_visible := true;
            NEW.status := 'confirme';

            UPDATE public.reports
            SET is_publicly_visible = true, status = 'confirme'
            WHERE category = 'sante'
              AND establishment_id = NEW.establishment_id
              AND fact_type = NEW.fact_type
              AND created_at >= NOW() - INTERVAL '30 days'
              AND is_publicly_visible = false;
        ELSE
            NEW.is_publicly_visible := false;
            NEW.status := 'recu';
        END IF;
        RETURN NEW;
    END IF;

    -- Sécurité : visible
    IF NEW.category = 'securite' THEN
        NEW.is_publicly_visible := true;
        RETURN NEW;
    END IF;

    -- Mairies & Services publics : recoupement 3 signalements ou modération
    IF NEW.category = 'mairies_services' AND NEW.establishment_id IS NOT NULL THEN
        SELECT COUNT(*) INTO concordant_count
        FROM public.reports
        WHERE category = 'mairies_services'
          AND establishment_id = NEW.establishment_id
          AND fact_type = NEW.fact_type
          AND created_at >= NOW() - INTERVAL '30 days';

        IF (concordant_count + 1) >= 3 THEN
            NEW.is_publicly_visible := true;
            NEW.status := 'confirme';
            
            UPDATE public.reports
            SET is_publicly_visible = true, status = 'confirme'
            WHERE category = 'mairies_services'
              AND establishment_id = NEW.establishment_id
              AND fact_type = NEW.fact_type
              AND created_at >= NOW() - INTERVAL '30 days'
              AND is_publicly_visible = false;
        ELSE
            NEW.is_publicly_visible := false;
        END IF;
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_evaluate_report_visibility
BEFORE INSERT ON public.reports
FOR EACH ROW EXECUTE FUNCTION evaluate_report_visibility();

-- ==============================================================================
-- 8. VUE STATISTIQUES PUBLIQUES
-- ==============================================================================

CREATE OR REPLACE VIEW public.v_establishment_stats AS
SELECT 
    e.id AS establishment_id,
    e.name AS establishment_name,
    e.category AS establishment_category,
    e.commune,
    e.region,
    COUNT(r.id) AS total_reports,
    COUNT(r.id) FILTER (WHERE r.created_at >= NOW() - INTERVAL '90 days') AS reports_last_quarter,
    COUNT(r.id) FILTER (WHERE r.created_at >= NOW() - INTERVAL '30 days') AS reports_last_month,
    COUNT(r.id) FILTER (WHERE r.status = 'resolu') AS total_resolved,
    ROUND(AVG(r.waiting_time_minutes) FILTER (WHERE r.waiting_time_minutes IS NOT NULL)) AS avg_waiting_time_minutes
FROM public.establishments e
LEFT JOIN public.reports r ON r.establishment_id = e.id
GROUP BY e.id, e.name, e.category, e.commune, e.region;

-- ==============================================================================
-- 9. SÉCURITÉ RLS (Row Level Security)
-- ==============================================================================

ALTER TABLE public.establishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read establishments" 
ON public.establishments FOR SELECT 
TO anon, authenticated 
USING (is_active = true);

CREATE POLICY "Public read visible reports" 
ON public.reports FOR SELECT 
TO anon, authenticated 
USING (is_publicly_visible = true);

CREATE POLICY "Public insert reports with rate limit" 
ON public.reports FOR INSERT 
TO anon, authenticated 
WITH CHECK (
    (
        SELECT COUNT(*) 
        FROM public.reports r 
        WHERE r.device_fingerprint = device_fingerprint 
          AND r.created_at >= NOW() - INTERVAL '24 hours'
    ) < 10
);

CREATE POLICY "Admin update reports" 
ON public.reports FOR UPDATE 
TO authenticated 
USING (auth.jwt() ->> 'role' = 'admin' OR (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean = true);

CREATE POLICY "Public read interactions" 
ON public.report_interactions FOR SELECT 
TO anon, authenticated 
USING (true);

CREATE POLICY "Public insert interactions" 
ON public.report_interactions FOR INSERT 
TO anon, authenticated 
WITH CHECK (true);

CREATE POLICY "Public insert content flags" 
ON public.content_flags FOR INSERT 
TO anon, authenticated 
WITH CHECK (true);

CREATE POLICY "Admin read content flags" 
ON public.content_flags FOR SELECT 
TO authenticated 
USING (auth.jwt() ->> 'role' = 'admin' OR (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean = true);

CREATE POLICY "Public read app settings" 
ON public.app_settings FOR SELECT 
TO anon, authenticated 
USING (true);

-- ==============================================================================
-- 10. JEU DE DONNÉES INITIAL : ÉTABLISSEMENTS DE RÉFÉRENCE (DAKAR & RÉGIONS)
-- ==============================================================================

INSERT INTO public.establishments (name, category, region, department, commune, latitude, longitude) VALUES
('Hôpital Principal de Dakar', 'hopital', 'Dakar', 'Dakar', 'Dakar Plateau', 14.6644, -17.4332),
('Hôpital Aristide Le Dantec', 'hopital', 'Dakar', 'Dakar', 'Dakar Plateau', 14.6582, -17.4367),
('Centre Hospitalier National Universitaire de Fann (CHNU Fann)', 'hopital', 'Dakar', 'Dakar', 'Fann-Point E-Amitié', 14.6933, -17.4728),
('Hôpital Général Idrissa Pouye (HOGIP - ex Grand Yoff)', 'hopital', 'Dakar', 'Dakar', 'Grand Yoff', 14.7335, -17.4526),
('Hôpital d''Enfants Albert Royer', 'hopital', 'Dakar', 'Dakar', 'Fann', 14.6941, -17.4735),
('Hôpital Militaire d''Ouakam (HMO)', 'hopital', 'Dakar', 'Dakar', 'Ouakam', 14.7214, -17.4891),
('Hôpital Dalal Jamm', 'hopital', 'Dakar', 'Guédiawaye', 'Golf Sud', 14.7786, -17.4042),
('Hôpital Roi Baudouin', 'hopital', 'Dakar', 'Guédiawaye', 'Sam Notaire', 14.7675, -17.3941),
('Hôpital Abass Ndao', 'hopital', 'Dakar', 'Dakar', 'Médina', 14.6865, -17.4533),
('Centre Hospitalier Régional Heinrich Lübke de Diourbel', 'hopital', 'Diourbel', 'Diourbel', 'Diourbel', 14.6568, -16.2307),
('Hôpital Matlaboul Fawzayni de Touba', 'hopital', 'Diourbel', 'Mbacké', 'Touba', 14.8682, -15.8824),
('Centre Hospitalier Régional Amadou Sakhir Mbaye de Louga', 'hopital', 'Louga', 'Louga', 'Louga', 15.6171, -16.2289),
('Hôpital Régional de Thiès (El Hadji Ahmadou Sakhir Ndiéguène)', 'hopital', 'Thiès', 'Thiès', 'Thiès', 14.7892, -16.9261),
('Centre Hospitalier Régional de Saint-Louis', 'hopital', 'Saint-Louis', 'Saint-Louis', 'Saint-Louis', 16.0274, -16.5019),
('Mairie de la Ville de Dakar', 'mairie', 'Dakar', 'Dakar', 'Dakar Plateau', 14.6710, -17.4339),
('Mairie des Parcelles Assainies', 'mairie', 'Dakar', 'Dakar', 'Parcelles Assainies', 14.7578, -17.4431),
('Mairie de Grand Yoff', 'mairie', 'Dakar', 'Dakar', 'Grand Yoff', 14.7289, -17.4512),
('Mairie de Guédiawaye', 'mairie', 'Dakar', 'Guédiawaye', 'Ndiarème Limamoulaye', 14.7712, -17.3912),
('Mairie de Pikine', 'mairie', 'Dakar', 'Pikine', 'Pikine Ouest', 14.7521, -17.3978),
('Mairie de Rufisque', 'mairie', 'Dakar', 'Rufisque', 'Rufisque Est', 14.7167, -17.2667),
('Centre d''État Civil Principal de Dakar Plateau', 'service_public', 'Dakar', 'Dakar', 'Dakar Plateau', 14.6695, -17.4350),
('Centre des Services Fiscaux Dakar 1', 'service_public', 'Dakar', 'Dakar', 'Dakar Plateau', 14.6730, -17.4380);
