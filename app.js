// ==============================================================================
// SignalsSN — Application Principale PWA (JavaScript Vanilla)
// Logique mobile-first : compression photo, champs dynamiques, Leaflet, Supabase
// ==============================================================================

// --- 1. INITIALISATION SUPABASE CLIENT ---
let supabaseClient = null;
const isSupabaseConfigured = CONFIG.SUPABASE_ANON_KEY && !CONFIG.SUPABASE_ANON_KEY.includes("COLLE_TA_CLE_ANON_ICI");

if (isSupabaseConfigured && window.supabase) {
    try {
        supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
        console.log("Connecté à Supabase avec succès !");
    } catch (e) {
        console.error("Erreur d'initialisation Supabase:", e);
    }
} else {
    console.warn("Clé Supabase anon en attente. Mode démo actif pour test immédiat.");
}

// Données démo initiales pour test immédiat si Supabase pas encore configuré
const DEFAULT_ESTABLISHMENTS = [
    { id: "e1", name: "Hôpital Principal de Dakar", category: "hopital", commune: "Dakar Plateau", region: "Dakar", latitude: 14.6644, longitude: -17.4332 },
    { id: "e2", name: "Hôpital Aristide Le Dantec", category: "hopital", commune: "Dakar Plateau", region: "Dakar", latitude: 14.6582, longitude: -17.4367 },
    { id: "e3", name: "CHNU de Fann (Hôpital Fann)", category: "hopital", commune: "Fann-Point E", region: "Dakar", latitude: 14.6933, longitude: -17.4728 },
    { id: "e4", name: "Hôpital Général Idrissa Pouye (HOGIP)", category: "hopital", commune: "Grand Yoff", region: "Dakar", latitude: 14.7335, longitude: -17.4526 },
    { id: "e5", name: "Hôpital Dalal Jamm", category: "hopital", commune: "Golf Sud", region: "Dakar", latitude: 14.7786, longitude: -17.4042 },
    { id: "e6", name: "Hôpital Roi Baudouin", category: "hopital", commune: "Guédiawaye", region: "Dakar", latitude: 14.7675, longitude: -17.3941 },
    { id: "e7", name: "Mairie des Parcelles Assainies", category: "mairie", commune: "Parcelles Assainies", region: "Dakar", latitude: 14.7578, longitude: -17.4431 },
    { id: "e8", name: "Mairie de Grand Yoff", category: "mairie", commune: "Grand Yoff", region: "Dakar", latitude: 14.7289, longitude: -17.4512 },
    { id: "e9", name: "Centre d'État Civil Dakar Plateau", category: "service_public", commune: "Dakar Plateau", region: "Dakar", latitude: 14.6695, longitude: -17.4350 }
];

let liveEstablishments = [...DEFAULT_ESTABLISHMENTS];

async function loadEstablishmentsFromDb() {
    if (supabaseClient) {
        try {
            const { data, error } = await supabaseClient
                .from("establishments")
                .select("*")
                .eq("is_active", true)
                .order("name", { ascending: true });
            if (!error && data && data.length > 0) {
                liveEstablishments = data;
                console.log(`${data.length} établissements chargés depuis Supabase.`);
            }
        } catch (e) {
            console.warn("Utilisation de la liste locale d'établissements:", e);
        }
    }
}
loadEstablishmentsFromDb();

let demoReports = [
    {
        id: "rep-1",
        category: "insalubrite",
        status: "confirme",
        location_name: "Rond-point Case Bi, Parcelles Assainies",
        latitude: 14.7592,
        longitude: -14.7592,
        incident_date: "2026-10-15",
        fact_type: "Déchets sauvages & Eau stagnante",
        factual_description: "Accumulation de détritus obstruant l'évacuation des eaux de pluie sur la chaussée principale.",
        immediate_danger: true,
        photo_url: "https://images.unsplash.com/photo-1605600659873-d808a13e4d2a?w=600&auto=format&fit=crop&q=60",
        reporter_role: "present",
        moi_aussi_count: 38,
        important_count: 14,
        resolu_count: 0,
        is_publicly_visible: true,
        created_at: new Date(Date.now() - 3600000 * 5).toISOString()
    },
    {
        id: "rep-2",
        category: "sante",
        status: "confirme",
        establishment_name: "CHNU de Fann (Hôpital Fann)",
        service_name: "Service des Urgences",
        location_name: "Fann, Dakar",
        latitude: 14.6933,
        longitude: -17.4728,
        incident_date: "2026-10-16",
        fact_type: "Attente excessive constatée",
        waiting_time_minutes: 240,
        factual_description: "Temps d'attente supérieur à 4 heures aux urgences avec absence de médecin de garde au tri à 21h.",
        reporter_role: "victime",
        moi_aussi_count: 52,
        important_count: 29,
        resolu_count: 1,
        is_publicly_visible: true,
        created_at: new Date(Date.now() - 3600000 * 12).toISOString()
    },
    {
        id: "rep-3",
        category: "mairies_services",
        status: "transmis",
        establishment_name: "Mairie de Grand Yoff",
        service_name: "Guichet État Civil",
        location_name: "Grand Yoff",
        latitude: 14.7289,
        longitude: -17.4512,
        incident_date: "2026-10-16",
        fact_type: "Fermé aux heures officielles affichées",
        factual_description: "Guichet des légalisations fermé à 14h30 alors que l'affichage officiel indique 16h30.",
        reporter_role: "present",
        moi_aussi_count: 19,
        important_count: 8,
        resolu_count: 0,
        is_publicly_visible: true,
        created_at: new Date(Date.now() - 3600000 * 24).toISOString()
    }
];

// --- 2. GESTION DE LA NAVIGATION & DES VUES ---
const navButtons = document.querySelectorAll(".nav-item");
const viewSections = document.querySelectorAll(".view-section");
let currentCategoryFilter = "all";
let mapInstance = null;
let mapMarkers = [];

navButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-target");
        
        navButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        
        viewSections.forEach(v => v.classList.remove("active"));
        const targetView = document.getElementById(targetId);
        if (targetView) targetView.classList.add("active");
        
        window.scrollTo({ top: 0, behavior: "smooth" });
        
        if (targetId === "view-map") {
            setTimeout(initOrRefreshMap, 200);
        } else if (targetId === "view-stats") {
            loadEstablishmentStats();
        } else if (targetId === "view-new") {
            syncCurrentDateTime();
        }
    });
});

// Synchronisation automatique de la date et heure du téléphone
function syncCurrentDateTime() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    
    const dateInput = document.getElementById("incident-date");
    const timeInput = document.getElementById("incident-time");
    
    if (dateInput) dateInput.value = `${y}-${m}-${d}`;
    if (timeInput) timeInput.value = `${hh}:${mm}`;
}

// Navigation directe depuis l'Empty State
window.goToReportWithCategory = function(cat) {
    const newBtn = document.querySelector('.nav-item[data-target="view-new"]');
    if (newBtn) newBtn.click();
    if (cat && cat !== "all") {
        categorySelect.value = cat;
        renderDynamicFields(cat);
    }
};

// --- 3. GESTION DU FILTRAGE DU FIL PUBLIC ---
const filterChips = document.querySelectorAll(".filter-chip");
filterChips.forEach(chip => {
    chip.addEventListener("click", () => {
        filterChips.forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        currentCategoryFilter = chip.getAttribute("data-category");
        renderReportsList();
    });
});

// --- 4. CHARGEMENT & AFFICHAGE DU FIL DE SIGNALEMENTS ---
async function fetchReports() {
    if (supabaseClient) {
        try {
            const { data, error } = await supabaseClient
                .from("reports")
                .select("*, establishments(name)")
                .eq("is_publicly_visible", true)
                .order("created_at", { ascending: false });
            
            if (!error && data) {
                return data.map(r => ({
                    ...r,
                    establishment_name: r.establishments ? r.establishments.name : r.location_name
                }));
            }
        } catch (e) {
            console.error("Erreur lors de la récupération Supabase:", e);
        }
    }
    // Fallback données démo
    return demoReports;
}

async function renderReportsList() {
    const listContainer = document.getElementById("reports-list");
    listContainer.innerHTML = `<div style="text-align: center; padding: 25px; color: var(--text-secondary);">Mise à jour des faits en direct...</div>`;
    
    const reports = await fetchReports();
    const filtered = currentCategoryFilter === "all" 
        ? reports 
        : reports.filter(r => r.category === currentCategoryFilter);
    
    if (filtered.length === 0) {
        const catNames = {
            insalubrite: "Insalubrité & Voirie",
            sante: "Santé & Hôpitaux",
            mairies_services: "Mairies & Services",
            securite: "Sécurité"
        };
        const catTitle = catNames[currentCategoryFilter] || "cette catégorie";
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; background: white; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                <span style="font-size: 2.2rem;">🕊️</span>
                <p style="font-weight: 700; margin-top: 10px; font-size: 1.05rem; color: var(--text-primary);">Aucun fait signalé dans ${escapeHtml(catTitle)}</p>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 16px;">
                    Soyez le premier citoyen à documenter un fait factuel vérifiable.
                </p>
                <button type="button" class="btn-submit" onclick="goToReportWithCategory('${currentCategoryFilter}')" style="max-width: 280px; margin: 0 auto; padding: 10px 16px; font-size: 0.88rem;">
                    ➕ Signaler un fait ${currentCategoryFilter !== 'all' ? 'ici' : ''}
                </button>
            </div>
        `;
        return;
    }
    
    const deviceFp = getDeviceFingerprint();
    const userInteractions = JSON.parse(localStorage.getItem("signasn_user_votes") || "{}");
    
    listContainer.innerHTML = filtered.map(report => {
        const catBadgeClass = "tag-" + (report.category === "mairies_services" ? "mairies" : report.category);
        const catLabels = {
            insalubrite: "🗑️ Insalubrité & Bâtiment",
            sante: "🏥 Santé Publique",
            mairies_services: "🏛️ Mairie & Service",
            securite: "🛡️ Zone Vigilance"
        };
        
        const statusLabels = {
            recu: "⚪ Reçu",
            confirme: "🟠 Confirmé",
            transmis: "🔵 Transmis",
            resolu: "🟢 Résolu"
        };
        
        const isMoiAussiActive = userInteractions[`${report.id}_moi_aussi`] ? "active-moi-aussi" : "";
        const isImportantActive = userInteractions[`${report.id}_important`] ? "active-important" : "";
        const isResoluActive = userInteractions[`${report.id}_resolu`] ? "active-resolu" : "";
        
        const whatsappText = encodeURIComponent(
            `🇸🇳 *SignalsSN — Fait Citoyen Documenté*\n📍 Lieu : ${report.establishment_name || report.location_name}\n📌 Fait : ${report.fact_type}\nStatut : ${statusLabels[report.status] || 'Confirmé'}\n👉 Suivre : https://github.com/makhatoure/SignaSN`
        );
        
        return `
            <div class="report-card" id="card-${report.id}">
                <div class="report-header">
                    <span class="report-category-tag ${catBadgeClass}">
                        ${catLabels[report.category] || report.category}
                    </span>
                    <span class="status-badge status-${report.status}">
                        ${statusLabels[report.status] || report.status}
                    </span>
                </div>
                
                <div class="report-location">
                    📍 ${escapeHtml(report.establishment_name || report.location_name)}
                </div>
                
                <div class="report-meta-line">
                    ${report.service_name ? `<span>🏛️ <strong>${escapeHtml(report.service_name)}</strong></span> •` : ''}
                    <span>📅 ${report.incident_date}</span>
                    ${report.waiting_time_minutes ? `• ⏱️ Attente : <strong>${report.waiting_time_minutes} min</strong>` : ''}
                    ${report.immediate_danger ? `• <span style="color: var(--rouge-sn); font-weight: 700;">⚠️ Danger Immédiat</span>` : ''}
                </div>
                
                <div class="fact-badge">
                    📌 ${escapeHtml(report.fact_type)}
                </div>
                
                <div class="report-description">
                    ${escapeHtml(report.factual_description)}
                </div>
                
                ${report.photo_url ? `
                    <img src="${report.photo_url}" class="report-photo" alt="Preuve factuelle" loading="lazy">
                ` : ''}
                
                <!-- Barre d'interactions prédéfinies V1 -->
                <div class="interactions-bar">
                    <button class="btn-action ${isMoiAussiActive}" onclick="handleInteraction('${report.id}', 'moi_aussi')">
                        👥 Moi aussi (${report.moi_aussi_count || 0})
                    </button>
                    <button class="btn-action ${isImportantActive}" onclick="handleInteraction('${report.id}', 'important')">
                        ⚠️ Important (${report.important_count || 0})
                    </button>
                    <button class="btn-action ${isResoluActive}" onclick="handleInteraction('${report.id}', 'resolu')">
                        ✅ Résolu (${report.resolu_count || 0})
                    </button>
                    <a href="https://api.whatsapp.com/send?text=${whatsappText}" target="_blank" class="btn-share-whatsapp" title="Partager sur WhatsApp">
                        💬 WhatsApp
                    </a>
                </div>
                
                <div style="display: flex; justify-content: flex-end; margin-top: 8px;">
                    <button class="btn-flag" onclick="openFlagModal('${report.id}')">
                        🚩 Signaler un nom ou abus (Retrait 24h)
                    </button>
                </div>
            </div>
        `;
    }).join("");
}

// Sécurisation HTML contre injection
function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/[&<>"']/g, function(m) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[m];
    });
}

// --- 5. GESTION DES INTERACTIONS PRÉDÉFINIES (Moi aussi, Important, Résolu) ---
async function handleInteraction(reportId, type) {
    const userVotes = JSON.parse(localStorage.getItem("signasn_user_votes") || "{}");
    const voteKey = `${reportId}_${type}`;
    
    if (userVotes[voteKey]) {
        alert("Vous avez déjà validé cette action.");
        return;
    }
    
    userVotes[voteKey] = true;
    localStorage.setItem("signasn_user_votes", JSON.stringify(userVotes));
    
    // Si Supabase est connecté
    if (supabaseClient) {
        try {
            await supabaseClient.from("report_interactions").insert({
                report_id: reportId,
                interaction: type,
                device_fingerprint: getDeviceFingerprint()
            });
        } catch (e) {
            console.error("Erreur interaction Supabase:", e);
        }
    } else {
        // En mode démo locale
        const rep = demoReports.find(r => r.id === reportId);
        if (rep) {
            if (type === "moi_aussi") rep.moi_aussi_count = (rep.moi_aussi_count || 0) + 1;
            if (type === "important") rep.important_count = (rep.important_count || 0) + 1;
            if (type === "resolu") rep.resolu_count = (rep.resolu_count || 0) + 1;
        }
    }
    
    renderReportsList();
}

// --- 6. FORMULAIRE DYNAMIQUE SELON LA CATÉGORIE ---
const categorySelect = document.getElementById("category-select");
const dynamicContainer = document.getElementById("dynamic-category-fields");
const photoLabel = document.getElementById("photo-label");
const photoInput = document.getElementById("photo-input");

categorySelect.addEventListener("change", (e) => {
    const category = e.target.value;
    renderDynamicFields(category);
});

function renderDynamicFields(category) {
    const locationLabel = document.getElementById("location-label");
    const locationInput = document.getElementById("location-input");
    const gpsContainer = document.getElementById("gps-button-container");

    if (!category) {
        dynamicContainer.innerHTML = "";
        if (locationLabel) locationLabel.innerHTML = `Lieu précis ou repère <span class="required">*</span>`;
        if (locationInput) {
            locationInput.placeholder = "Ex: Croisement 22 Parcelles, Entrée Urgences Fann...";
            locationInput.required = true;
        }
        if (gpsContainer) gpsContainer.style.display = "flex";
        return;
    }
    
    // Adaptation du champ de lieu selon la catégorie
    if (category === "sante" || category === "mairies_services") {
        if (locationLabel) locationLabel.innerHTML = `Précision d'accès dans l'établissement <span style="font-weight: normal; color: var(--text-muted); font-size: 0.78rem;">(Bâtiment, service, étage, couloir... Optionnel)</span>`;
        if (locationInput) {
            locationInput.placeholder = "Ex: Bâtiment Pédiatrie, 1er étage, Guichet 2...";
            locationInput.required = false;
        }
        if (gpsContainer) gpsContainer.style.display = "none";
    } else {
        if (locationLabel) locationLabel.innerHTML = `Lieu précis, rue ou repère <span class="required">*</span>`;
        if (locationInput) {
            locationInput.placeholder = "Ex: Croisement 22 Parcelles, Rond-point Case Bi, près de la station...";
            locationInput.required = true;
        }
        if (gpsContainer) gpsContainer.style.display = "flex";
    }
    
    // Insalubrité : photo obligatoire, types physiques
    if (category === "insalubrite") {
        photoLabel.innerHTML = `Photo de l'anomalie <span class="required">* (Obligatoire)</span>`;
        photoInput.required = true;
        
        dynamicContainer.innerHTML = `
            <div class="form-group">
                <label class="form-label">Type d'anomalie physique <span class="required">*</span></label>
                <select id="fact-type-select" class="form-select" required>
                    <option value="">Sélectionnez le type...</option>
                    <option value="Déchets sauvages & Décharge">Décharge sauvage ou ordures non ramassées</option>
                    <option value="Fissure ou Risque d'effondrement">Fissure importante / Bâtiment menaçant ruine</option>
                    <option value="Eau stagnante & Risque paludisme">Eau stagnante / Canalisation rompue</option>
                    <option value="Câble électrique dénudé">Câble électrique dénudé ou poteau dangereux</option>
                    <option value="Nid-de-poule profond ou chaussée effondrée">Nid-de-poule dangereux ou chaussée détruite</option>
                </select>
            </div>
            <div class="form-group" style="background: #f8fafc; padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                <label style="font-size: 0.85rem; display: flex; align-items: center; gap: 8px; font-weight: 600; color: var(--rouge-sn);">
                    <input type="checkbox" id="immediate-danger-checkbox"> ⚠️ Danger immédiat pour la vie humaine
                </label>
            </div>
        `;
    }
    
    // Santé : Établissement prédéfini, service, durée d'attente
    else if (category === "sante") {
        photoLabel.innerHTML = `Photo du lieu (Optionnel - Pas de visages de patients)`;
        photoInput.required = false;
        
        dynamicContainer.innerHTML = `
            <div class="form-group">
                <label class="form-label">Structure hospitalière de référence <span class="required">*</span></label>
                <select id="establishment-select" class="form-select" required>
                    <option value="">Sélectionnez un hôpital / centre...</option>
                    ${liveEstablishments.filter(e => e.category === "hopital").map(e => `
                        <option value="${e.id}" data-lat="${e.latitude}" data-lng="${e.longitude}" data-name="${e.name}">${e.name} (${e.commune})</option>
                    `).join("")}
                </select>
                <p class="form-help">💡 Note : Votre signalement sera publié dès qu'il aura été recoupé par 3 faits concordants.</p>
            </div>
            
            <div class="form-group">
                <label class="form-label">Service concerné <span class="required">*</span></label>
                <select id="service-select" class="form-select" required>
                    <option value="">Sélectionnez le service...</option>
                    <option value="Urgences">Urgences</option>
                    <option value="Maternité & Gynécologie">Maternité & Gynécologie</option>
                    <option value="Pédiatrie">Pédiatrie</option>
                    <option value="Pharmacie & Caisse">Pharmacie & Caisse</option>
                    <option value="Médecine Générale">Médecine Générale</option>
                    <option value="Radiologie / Imagerie">Radiologie / Imagerie</option>
                    <option value="Laboratoire d'analyses">Laboratoire d'analyses</option>
                </select>
            </div>
            
            <div class="form-group">
                <label class="form-label">Type de fait matériel <span class="required">*</span></label>
                <select id="fact-type-select" class="form-select" required>
                    <option value="">Sélectionnez le constat...</option>
                    <option value="Personnel de garde absent">Personnel soignant absent au poste</option>
                    <option value="Matériel d'urgence en panne">Appareil indispensable en panne (Scanner, Radio...)</option>
                    <option value="Attente excessive (> 3h)">Attente excessive (> 3 heures)</option>
                    <option value="Rupture de produit d'urgence">Rupture de médicament / produit de réanimation</option>
                    <option value="Négligence factuelle constatée">Négligence matérielle constatée</option>
                </select>
            </div>
            
            <div class="form-group">
                <label class="form-label">Durée d'attente constatée (en minutes)</label>
                <input type="number" id="waiting-time-input" class="form-control" placeholder="Ex: 180 (pour 3 heures)" min="0" max="1440">
            </div>
        `;
        
        // Auto-remplissage du lieu lors de la sélection de l'établissement
        const estSelect = document.getElementById("establishment-select");
        estSelect.addEventListener("change", (e) => {
            const opt = e.target.selectedOptions[0];
            if (opt) {
                document.getElementById("location-input").value = opt.getAttribute("data-name");
                document.getElementById("lat-input").value = opt.getAttribute("data-lat");
                document.getElementById("lng-input").value = opt.getAttribute("data-lng");
            }
        });
    }
    
    // Mairies & Services publics
    else if (category === "mairies_services") {
        photoLabel.innerHTML = `Photo du panneau ou des horaires affichés (Optionnel)`;
        photoInput.required = false;
        
        dynamicContainer.innerHTML = `
            <div class="form-group">
                <label class="form-label">Mairie ou Service Public <span class="required">*</span></label>
                <select id="establishment-select" class="form-select" required>
                    <option value="">Sélectionnez l'administration...</option>
                    ${liveEstablishments.filter(e => e.category === "mairie" || e.category === "service_public").map(e => `
                        <option value="${e.id}" data-lat="${e.latitude}" data-lng="${e.longitude}" data-name="${e.name}">${e.name} (${e.commune})</option>
                    `).join("")}
                </select>
            </div>
            
            <div class="form-group">
                <label class="form-label">Service / Guichet <span class="required">*</span></label>
                <select id="service-select" class="form-select" required>
                    <option value="">Sélectionnez le guichet...</option>
                    <option value="État Civil (Naissances / Mariages)">État Civil (Naissances / Mariages)</option>
                    <option value="Légalisation de documents">Légalisation de documents</option>
                    <option value="Services Fiscaux / Impôts">Services Fiscaux / Impôts</option>
                    <option value="Urbanisme & Voirie">Urbanisme & Voirie</option>
                    <option value="Direction Technique">Direction Technique</option>
                </select>
            </div>
            
            <div class="form-group">
                <label class="form-label">Type d'anomalie factuelle <span class="required">*</span></label>
                <select id="fact-type-select" class="form-select" required>
                    <option value="">Sélectionnez le fait...</option>
                    <option value="Fermé aux heures affichées">Guichet fermé pendant les heures officielles d'ouverture</option>
                    <option value="Agent absent au poste">Agent absent au guichet sans indication</option>
                    <option value="Service refusé sans motif">Dossier refusé sans motif administratif légal</option>
                    <option value="Paiement sans reçu délivré">Demande de paiement sans délivrance de reçu officiel</option>
                </select>
            </div>
        `;
        
        const estSelect = document.getElementById("establishment-select");
        estSelect.addEventListener("change", (e) => {
            const opt = e.target.selectedOptions[0];
            if (opt) {
                document.getElementById("location-input").value = opt.getAttribute("data-name");
                document.getElementById("lat-input").value = opt.getAttribute("data-lat");
                document.getElementById("lng-input").value = opt.getAttribute("data-lng");
            }
        });
    }
    
    // Sécurité : Zones sans description physique individuelle
    else if (category === "securite") {
        photoLabel.innerHTML = `Photo du lieu / de la ruelle (Sans personnes)`;
        photoInput.required = false;
        
        dynamicContainer.innerHTML = `
            <div class="form-group">
                <label class="form-label">Type d'incident de sécurité <span class="required">*</span></label>
                <select id="fact-type-select" class="form-select" required>
                    <option value="">Sélectionnez le type...</option>
                    <option value="Vol à l'arraché (Scooter / Piéton)">Vol à l'arraché (Scooter / Piéton)</option>
                    <option value="Agression physique sur la voie publique">Agression physique sur la voie publique</option>
                    <option value="Zone non éclairée - Coupe-gorge dangereux">Zone non éclairée / Absence d'éclairage public</option>
                    <option value="Cambriolage de commerce / maison">Cambriolage de commerce ou maison</option>
                </select>
            </div>
            
            <div class="form-group">
                <label class="form-label">Moment de la journée <span class="required">*</span></label>
                <select id="moment-select" class="form-select" required>
                    <option value="matin">Matinée (06h - 12h)</option>
                    <option value="apres_midi">Après-midi (12h - 18h)</option>
                    <option value="soir">Soirée (18h - 23h)</option>
                    <option value="nuit">Pleine nuit (23h - 06h)</option>
                </select>
            </div>
            
            <div class="form-group">
                <label class="form-label">Nombre de personnes impliquées</label>
                <input type="number" id="people-count-input" class="form-control" placeholder="Chiffre uniquement (Ex: 2)" min="1" max="50">
                <p class="form-help">⚠️ Attention : Ne décrivez aucune caractéristique physique individuelle conformément à la charte.</p>
            </div>
        `;
    }
}

// --- 7. GÉOLOCALISATION GPS CLIENT ---
const btnGps = document.getElementById("btn-gps");
const gpsStatus = document.getElementById("gps-status");

btnGps.addEventListener("click", () => {
    if (!navigator.geolocation) {
        gpsStatus.textContent = "GPS non supporté sur ce navigateur";
        return;
    }
    
    gpsStatus.textContent = "Localisation en cours...";
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            document.getElementById("lat-input").value = lat;
            document.getElementById("lng-input").value = lng;
            gpsStatus.textContent = `📍 Coordonnées acquises (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
            gpsStatus.style.color = "var(--vert-sn)";
        },
        (err) => {
            gpsStatus.textContent = "Autorisation GPS refusée";
            gpsStatus.style.color = "var(--rouge-sn)";
        },
        { enableHighAccuracy: true, timeout: 8000 }
    );
});

// --- 8. COMPRESSION D'IMAGE VIA HTML5 CANVAS ---
let compressedPhotoData = null;

photoInput.addEventListener("change", function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const previewContainer = document.getElementById("photo-preview-container");
    const previewImg = document.getElementById("photo-preview");
    const compressionInfo = document.getElementById("photo-compression-info");
    
    const originalSizeKb = Math.round(file.size / 1024);
    
    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            // Redimensionnement max 1280px pour économiser la bande passante 3G
            const MAX_WIDTH = 1280;
            const MAX_HEIGHT = 1280;
            let width = img.width;
            let height = img.height;
            
            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }
            
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, width, height);
            
            // Compression en JPEG 70%
            compressedPhotoData = canvas.toDataURL("image/jpeg", 0.7);
            
            // Calcul de la taille compressée
            const compressedSizeKb = Math.round((compressedPhotoData.length * 3 / 4) / 1024);
            const reduction = Math.round((1 - (compressedSizeKb / originalSizeKb)) * 100);
            
            previewImg.src = compressedPhotoData;
            compressionInfo.textContent = `⚡ Compressée : ${originalSizeKb} Ko ➔ ${compressedSizeKb} Ko (-${reduction}%) pour réseau mobile`;
            previewContainer.style.display = "block";
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

// --- 9. FILTRE ANTI-NOMS & ANTI-DIFFAMATION CÔTÉ CLIENT ---
const descriptionInput = document.getElementById("description-input");
const charCount = document.getElementById("char-count");
const filterWarning = document.getElementById("filter-warning");

// Mots sensibles indicatifs pour sensibiliser l'utilisateur
const SENSITIVE_WORDS = [
    "docteur", "dr.", "directeur", "monsieur", "madame", "mme", "m.", 
    "voleur", "escroc", "menteur", "imbecile", "maudit", "salopard"
];

descriptionInput.addEventListener("input", (e) => {
    const val = e.target.value;
    charCount.textContent = val.length;
    
    const lower = val.toLowerCase();
    const hasSensitive = SENSITIVE_WORDS.some(word => lower.includes(word));
    
    if (hasSensitive) {
        filterWarning.style.display = "block";
    } else {
        filterWarning.style.display = "none";
    }
});

// --- 10. SOUMISSION DU FORMULAIRE ---
const reportForm = document.getElementById("report-form");
const incidentDateInput = document.getElementById("incident-date");
// Date par défaut aujourd'hui
incidentDateInput.value = new Date().toISOString().split("T")[0];

reportForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const submitBtn = document.getElementById("btn-submit-report");
    submitBtn.disabled = true;
    submitBtn.textContent = "Transmission en cours...";
    
    const category = categorySelect.value;
    const locationName = document.getElementById("location-input").value;
    const lat = parseFloat(document.getElementById("lat-input").value) || null;
    const lng = parseFloat(document.getElementById("lng-input").value) || null;
    const incidentDate = incidentDateInput.value;
    const incidentTime = document.getElementById("incident-time").value || null;
    const description = descriptionInput.value;
    const reporterRole = document.querySelector('input[name="reporter_role"]:checked').value;
    
    const factTypeSelect = document.getElementById("fact-type-select");
    const factType = factTypeSelect ? factTypeSelect.value : "Anomalie constatée";
    
    const estSelect = document.getElementById("establishment-select");
    const establishmentId = estSelect && estSelect.value ? estSelect.value : null;
    const establishmentName = estSelect && estSelect.value ? estSelect.selectedOptions[0].getAttribute("data-name") : null;
    
    const serviceSelect = document.getElementById("service-select");
    const serviceName = serviceSelect ? serviceSelect.value : null;
    
    const waitingInput = document.getElementById("waiting-time-input");
    const waitingTime = waitingInput ? parseInt(waitingInput.value, 10) : null;
    
    const dangerCheckbox = document.getElementById("immediate-danger-checkbox");
    const immediateDanger = dangerCheckbox ? dangerCheckbox.checked : false;
    
    const peopleInput = document.getElementById("people-count-input");
    const peopleCount = peopleInput ? parseInt(peopleInput.value, 10) : null;
    
    // Si un établissement est sélectionné, il constitue le repère principal
    let finalLocationName = locationName;
    if (establishmentName) {
        finalLocationName = locationName ? `${establishmentName} (${locationName})` : establishmentName;
    }

    const newReport = {
        category,
        status: (category === "insalubrite" || category === "securite") ? "confirme" : "recu",
        establishment_id: establishmentId,
        establishment_name: establishmentName,
        service_name: serviceName,
        location_name: finalLocationName,
        latitude: lat || 14.6937,
        longitude: lng || -17.4441,
        incident_date: incidentDate,
        incident_time: incidentTime,
        moment_of_day: momentOfDay,
        fact_type: factType,
        waiting_time_minutes: waitingTime,
        immediate_danger: immediateDanger,
        people_involved_count: peopleCount,
        factual_description: description,
        photo_url: compressedPhotoData,
        reporter_role: reporterRole,
        device_fingerprint: getDeviceFingerprint(),
        is_publicly_visible: (category === "insalubrite" || category === "securite"),
        moi_aussi_count: 1,
        important_count: 0,
        resolu_count: 0,
        created_at: new Date().toISOString()
    };
    
    if (supabaseClient) {
        try {
            const { data, error } = await supabaseClient.from("reports").insert([newReport]);
            if (error) {
                console.error("Erreur insertion Supabase:", error);
                alert("Erreur lors de la transmission : " + error.message);
                submitBtn.disabled = false;
                submitBtn.textContent = "Transmettre ce fait citoyen 🚀";
                return;
            }
        } catch (e) {
            console.error("Exception insertion:", e);
        }
    } else {
        // Enregistrement démo
        demoReports.unshift({
            id: "rep-" + Date.now(),
            ...newReport
        });
    }
    
    alert(
        category === "sante" 
        ? "✅ Fait enregistré avec succès ! Il sera rendu public automatiquement dès que 3 signalements concordants auront été constatés sur ce service."
        : "✅ Fait citoyen enregistré avec succès !"
    );
    
    reportForm.reset();
    compressedPhotoData = null;
    document.getElementById("photo-preview-container").style.display = "none";
    renderDynamicFields(null);
    syncCurrentDateTime();
    submitBtn.disabled = false;
    submitBtn.textContent = "Transmettre ce fait citoyen 🚀";
    
    // Basculer sur le fil public
    document.querySelector('.nav-item[data-target="view-feed"]').click();
});

// --- 11. CARTE INTERACTIVE LEAFLET / OPENSTREETMAP AVEC CLUSTERING ---
let markerClusterGroup = null;

function initOrRefreshMap() {
    const mapContainer = document.getElementById("map-container");
    if (!mapContainer) return;
    
    if (!mapInstance) {
        // Centré sur la région de Dakar
        mapInstance = L.map('map-container').setView([14.7167, -17.4333], 12);
        
        // Tuiles OpenStreetMap (100% gratuites et sans clé d'API)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap Sénégal | SignalsSN',
            maxZoom: 18
        }).addTo(mapInstance);
    } else {
        mapInstance.invalidateSize();
    }
    
    // Nettoyer les anciens clusters ou marqueurs
    if (markerClusterGroup) {
        mapInstance.removeLayer(markerClusterGroup);
        markerClusterGroup = null;
    }
    mapMarkers.forEach(m => mapInstance.removeLayer(m));
    mapMarkers = [];
    
    const hasClusterPlugin = typeof L.markerClusterGroup === 'function';
    if (hasClusterPlugin) {
        markerClusterGroup = L.markerClusterGroup({
            maxClusterRadius: 45,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true
        });
    }
    
    // Récupérer les signalements visibles avec coordonnées
    fetchReports().then(reports => {
        reports.forEach(r => {
            if (r.latitude && r.longitude) {
                const colors = {
                    insalubrite: "#E31B23",
                    sante: "#0284c7",
                    mairies_services: "#d97706",
                    securite: "#7c3aed"
                };
                const color = colors[r.category] || "#00853F";
                
                const circleMarker = L.circleMarker([r.latitude, r.longitude], {
                    radius: 9,
                    fillColor: color,
                    color: "#ffffff",
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.9
                });
                
                const popupContent = `
                    <div style="font-size: 0.85rem; font-family: sans-serif;">
                        <strong>📍 ${escapeHtml(r.establishment_name || r.location_name)}</strong><br>
                        <span style="color: ${color}; font-weight: bold;">${escapeHtml(r.fact_type)}</span><br>
                        <p style="margin: 4px 0;">${escapeHtml(r.factual_description)}</p>
                        <small>👥 ${r.moi_aussi_count || 0} confirmations</small>
                    </div>
                `;
                circleMarker.bindPopup(popupContent);
                
                if (hasClusterPlugin && markerClusterGroup) {
                    markerClusterGroup.addLayer(circleMarker);
                } else {
                    circleMarker.addTo(mapInstance);
                    mapMarkers.push(circleMarker);
                }
            }
        });
        
        if (hasClusterPlugin && markerClusterGroup) {
            mapInstance.addLayer(markerClusterGroup);
        }
    });
}

// --- 12. STATISTIQUES PUBLIQUES PAR ÉTABLISSEMENT ---
async function loadEstablishmentStats() {
    const container = document.getElementById("establishments-stats-list");
    const totalReportsEl = document.getElementById("stat-total-reports");
    const resolvedRateEl = document.getElementById("stat-resolved-rate");
    
    const reports = await fetchReports();
    totalReportsEl.textContent = reports.length;
    
    const resolvedCount = reports.filter(r => r.status === "resolu").length;
    const resolvedRate = reports.length > 0 ? Math.round((resolvedCount / reports.length) * 100) : 0;
    resolvedRateEl.textContent = resolvedRate + "%";
    
    // Groupement par établissement
    const statsMap = {};
    reports.forEach(r => {
        const name = r.establishment_name || r.location_name;
        if (!statsMap[name]) {
            statsMap[name] = { count: 0, waitingTotal: 0, waitingCount: 0, resolved: 0, category: r.category };
        }
        statsMap[name].count++;
        if (r.status === "resolu") statsMap[name].resolved++;
        if (r.waiting_time_minutes) {
            statsMap[name].waitingTotal += r.waiting_time_minutes;
            statsMap[name].waitingCount++;
        }
    });
    
    const entries = Object.entries(statsMap).sort((a, b) => b[1].count - a[1].count);
    
    container.innerHTML = entries.map(([name, stat]) => {
        const avgWait = stat.waitingCount > 0 ? Math.round(stat.waitingTotal / stat.waitingCount) + " min" : "N/A";
        return `
            <div style="background: white; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px 16px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong style="font-size: 0.95rem; color: var(--text-primary);">${escapeHtml(name)}</strong>
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
                        Temps d'attente moyen : <strong>${avgWait}</strong> • Résolus : <strong>${stat.resolved}</strong>
                    </div>
                </div>
                <div style="background: var(--vert-light); color: var(--vert-dark); font-weight: 800; font-size: 0.95rem; padding: 4px 10px; border-radius: var(--radius-full);">
                    ${stat.count} faits
                </div>
            </div>
        `;
    }).join("");
}

// --- 13. MODALES (Charte & Signalement de contenu) ---
const modalInfo = document.getElementById("modal-info");
const btnInfo = document.getElementById("btn-info-modal");
const btnCloseInfo = document.getElementById("btn-close-info");
const btnCloseInfoOk = document.getElementById("btn-close-info-ok");

btnInfo.addEventListener("click", () => modalInfo.style.display = "flex");
btnCloseInfo.addEventListener("click", () => modalInfo.style.display = "none");
btnCloseInfoOk.addEventListener("click", () => modalInfo.style.display = "none");

const modalFlag = document.getElementById("modal-flag");
const btnCloseFlag = document.getElementById("btn-close-flag");
const flagForm = document.getElementById("flag-form");

function openFlagModal(reportId) {
    document.getElementById("flag-report-id").value = reportId;
    modalFlag.style.display = "flex";
}

btnCloseFlag.addEventListener("click", () => modalFlag.style.display = "none");

flagForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const reportId = document.getElementById("flag-report-id").value;
    const reason = document.getElementById("flag-reason").value;
    const details = document.getElementById("flag-details").value;
    
    if (supabaseClient) {
        try {
            await supabaseClient.from("content_flags").insert({
                report_id: reportId,
                reason,
                details,
                reporter_device: getDeviceFingerprint()
            });
        } catch (e) {
            console.error("Erreur signalement contenu:", e);
        }
    }
    
    alert("🚩 Merci. Notre équipe de modération a reçu votre signalement et examinera ce contenu sous 24h.");
    flagForm.reset();
    modalFlag.style.display = "none";
});

// Fermeture des modales au clic extérieur
window.addEventListener("click", (e) => {
    if (e.target === modalInfo) modalInfo.style.display = "none";
    if (e.target === modalFlag) modalFlag.style.display = "none";
});

// Chargement initial
document.addEventListener("DOMContentLoaded", () => {
    syncCurrentDateTime();
    renderReportsList();
});
