// ==============================================================================
// SignalSN — Application Principale (Design conforme à la maquette)
// Mobile-first, Supabase, Leaflet MarkerCluster, compression Canvas
// ==============================================================================

// --- 1. CLIENT SUPABASE ---
let supabaseClient = null;
const isSupabaseConfigured = CONFIG.SUPABASE_ANON_KEY && !CONFIG.SUPABASE_ANON_KEY.includes("COLLE_TA_CLE_ANON_ICI");

if (isSupabaseConfigured && window.supabase) {
    try {
        supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
        console.log("Connecté à Supabase.");
    } catch (e) {
        console.error("Erreur initialisation Supabase:", e);
    }
}

// Liste par défaut des structures
const DEFAULT_ESTABLISHMENTS = [
    { id: "e1", name: "Hôpital Principal de Dakar", category: "hopital", commune: "Dakar Plateau", region: "Dakar", latitude: 14.6644, longitude: -17.4332 },
    { id: "e2", name: "Hôpital Aristide Le Dantec", category: "hopital", commune: "Dakar Plateau", region: "Dakar", latitude: 14.6582, longitude: -17.4367 },
    { id: "e3", name: "CHNU de Fann (Hôpital Fann)", category: "hopital", commune: "Fann-Point E", region: "Dakar", latitude: 14.6933, longitude: -17.4728 },
    { id: "e4", name: "Hôpital Général Idrissa Pouye (HOGIP)", category: "hopital", commune: "Grand Yoff", region: "Dakar", latitude: 14.7335, longitude: -17.4526 },
    { id: "e5", name: "Hôpital Dalal Jamm", category: "hopital", commune: "Golf Sud", region: "Dakar", latitude: 14.7786, longitude: -17.4042 },
    { id: "e6", name: "Hôpital Roi Baudouin", category: "hopital", commune: "Guédiawaye", region: "Dakar", latitude: 14.7675, longitude: -17.3941 },
    { id: "e7", name: "Mairie de la Ville de Dakar", category: "mairie", commune: "Dakar Plateau", region: "Dakar", latitude: 14.6710, longitude: -17.4339 },
    { id: "e8", name: "Mairie des Parcelles Assainies", category: "mairie", commune: "Parcelles Assainies", region: "Dakar", latitude: 14.7578, longitude: -17.4431 },
    { id: "e9", name: "Mairie de Grand Yoff", category: "mairie", commune: "Grand Yoff", region: "Dakar", latitude: 14.7289, longitude: -17.4512 },
    { id: "e10", name: "Mairie de Pikine", category: "mairie", commune: "Pikine", region: "Dakar", latitude: 14.7521, longitude: -17.3978 },
    { id: "e11", name: "Centre d'État Civil Dakar Plateau", category: "service_public", commune: "Dakar Plateau", region: "Dakar", latitude: 14.6695, longitude: -17.4350 }
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
            }
        } catch (e) {
            console.warn("Utilisation liste locale:", e);
        }
    }
    populateEstablishmentDropdown();
}
loadEstablishmentsFromDb();

// Données démo calquées sur les 3 exemples de la maquette
let demoReports = [
    {
        id: "rep-1",
        category: "sante",
        status: "transmis",
        establishment_name: "Hôpital Fann (CHNU)",
        service_name: "Service des Urgences",
        location_name: "Fann, Dakar",
        latitude: 14.6933,
        longitude: -17.4728,
        incident_date: "2026-10-16",
        incident_time: "10:30",
        fact_type: "Personnel absent",
        factual_description: "Absence constatée de personnel soignant de garde à l'accueil du triage des urgences.",
        immediate_danger: false,
        moi_aussi_count: 14,
        is_publicly_visible: true,
        created_at: new Date(Date.now() - 3600000 * 4).toISOString()
    },
    {
        id: "rep-2",
        category: "insalubrite",
        status: "confirme",
        establishment_name: "Croisement Case Bi",
        location_name: "Parcelles Assainies, Dakar",
        latitude: 14.7578,
        longitude: -17.4431,
        incident_date: "2026-10-16",
        incident_time: "08:15",
        fact_type: "Déchets",
        factual_description: "Dépôt sauvage d'ordures bloquant le passage piéton et le caniveau.",
        immediate_danger: true,
        moi_aussi_count: 42,
        is_publicly_visible: true,
        created_at: new Date(Date.now() - 3600000 * 8).toISOString()
    },
    {
        id: "rep-3",
        category: "mairies_services",
        status: "resolu",
        establishment_name: "Mairie de Grand Yoff",
        service_name: "Guichet État Civil",
        location_name: "Grand Yoff",
        latitude: 14.7289,
        longitude: -17.4512,
        incident_date: "2026-10-15",
        incident_time: "14:45",
        fact_type: "Fermé aux heures affichées",
        factual_description: "Guichet légalisation fermé avant l'horaire réglementaire affiché.",
        immediate_danger: false,
        moi_aussi_count: 27,
        is_publicly_visible: true,
        created_at: new Date(Date.now() - 3600000 * 20).toISOString()
    },
    {
        id: "rep-4",
        category: "voirie",
        status: "confirme",
        establishment_name: "Axe VDN - Échangeur Foire",
        location_name: "VDN, Foire, Dakar",
        latitude: 14.7325,
        longitude: -17.4610,
        incident_date: "2026-10-16",
        incident_time: "12:00",
        fact_type: "Nid-de-poule dangereux",
        factual_description: "Nid-de-poule profond sur la voie rapide provoquant des freinages brusques.",
        immediate_danger: true,
        moi_aussi_count: 53,
        is_publicly_visible: true,
        created_at: new Date(Date.now() - 3600000 * 6).toISOString()
    },
    {
        id: "rep-5",
        category: "eau_electricite",
        status: "confirme",
        establishment_name: "Médina, Rue 22",
        location_name: "Médina, Dakar",
        latitude: 14.6890,
        longitude: -17.4520,
        incident_date: "2026-10-16",
        incident_time: "16:20",
        fact_type: "Fuite d'eau sur voie publique",
        factual_description: "Canalisation principale d'eau rompue déversant de l'eau sur la chaussée depuis le matin.",
        immediate_danger: false,
        moi_aussi_count: 31,
        is_publicly_visible: true,
        created_at: new Date(Date.now() - 3600000 * 2).toISOString()
    }
];

// --- 2. NAVIGATION ENTRE ÉCRANS (BOTTOM NAV) ---
const navButtons = document.querySelectorAll(".bottom-nav-item");
const viewSections = document.querySelectorAll(".view-section");
let currentCategoryFilter = "all";
let currentStatFilter = "all";
let mapInstance = null;
let markerClusterGroup = null;

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

// Synchronisation automatique de la date et de l'heure du téléphone
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
    if (timeInput && !timeInput.value) timeInput.value = `${hh}:${mm}`;
}

// Navigation directe vers le formulaire depuis l'empty state
window.goToReportWithCategory = function(cat) {
    const newBtn = document.querySelector('.bottom-nav-item[data-target="view-new"]');
    if (newBtn) newBtn.click();
    if (cat && cat !== "all") {
        const catSelect = document.getElementById("category-select");
        if (catSelect) {
            catSelect.value = cat;
            renderDynamicCategoryFields(cat);
        }
    }
};

// --- 3. FILTRES DU FIL PUBLIC ---
const filterButtons = document.querySelectorAll("#view-feed .filter-btn");
filterButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        filterButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentCategoryFilter = btn.getAttribute("data-category");
        renderReportsList();
    });
});

// --- 4. RÉCUPÉRATION & RENDU DU FIL PUBLIC (CONFORME IMAGE 1) ---
async function fetchReports() {
    if (supabaseClient) {
        try {
            let data = null;
            let error = null;
            
            // Essai avec jointure establishments
            const res = await supabaseClient
                .from("reports")
                .select("*, establishments(name)")
                .eq("is_publicly_visible", true)
                .order("created_at", { ascending: false });
            
            data = res.data;
            error = res.error;
            
            // Si erreur de relation, repli sur select("*") direct
            if (error) {
                console.warn("Erreur jointure establishments, fallback select direct:", error);
                const simpleRes = await supabaseClient
                    .from("reports")
                    .select("*")
                    .eq("is_publicly_visible", true)
                    .order("created_at", { ascending: false });
                data = simpleRes.data;
                error = simpleRes.error;
            }
            
            if (!error && data) {
                return data.map(r => ({
                    ...r,
                    establishment_name: (r.establishments && r.establishments.name) ? r.establishments.name : r.location_name
                }));
            }
        } catch (e) {
            console.error("Erreur récupération Supabase:", e);
        }
    }
    return demoReports;
}

function formatDate(dateStr) {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
}

async function renderReportsList() {
    const listContainer = document.getElementById("reports-list");
    listContainer.innerHTML = `<div style="text-align: center; padding: 25px; color: var(--text-muted); font-size: 0.85rem;">Mise à jour...</div>`;
    
    const reports = await fetchReports();
    const filtered = currentCategoryFilter === "all" 
        ? reports 
        : reports.filter(r => r.category === currentCategoryFilter);
    
    if (filtered.length === 0) {
        const catNames = {
            insalubrite: "Insalubrité",
            voirie: "Routes et voirie",
            eau_electricite: "Eau et électricité",
            sante: "Santé",
            mairies_services: "Mairies",
            securite: "Sécurité"
        };
        const catTitle = catNames[currentCategoryFilter] || "cette catégorie";
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 35px 20px; border: 1px dashed var(--border-color); border-radius: var(--radius-md); margin-bottom: 16px;">
                <p style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">Aucun fait publié pour l'instant.</p>
                <p style="font-size: 0.8rem; color: var(--text-muted); margin: 6px 0 14px 0;">Soyez le premier à documenter un fait factuel.</p>
                <button type="button" class="btn-primary-submit" onclick="goToReportWithCategory('${currentCategoryFilter}')" style="max-width: 240px; margin: 0 auto; padding: 9px 14px; font-size: 0.85rem;">
                    + Signaler un fait
                </button>
            </div>
        `;
        return;
    }
    
    const userVotes = JSON.parse(localStorage.getItem("signalsn_user_votes") || "{}");
    
    const catIcons = {
        voirie: "🚧 Voirie",
        eau_electricite: "💧 Eau & Électricité",
        insalubrite: "🧹 Insalubrité",
        sante: "🏥 Santé",
        mairies_services: "🏛️ Services publics",
        securite: "🛡️ Sécurité"
    };

    const statusLabels = {
        publie: "Signalement citoyen non confirmé",
        recu: "Signalement citoyen non confirmé",
        confirme: "Confirmé",
        transmis: "Transmis",
        resolu: "Résolu",
        sans_suite: "Sans suite (30 j)"
    };

    listContainer.innerHTML = filtered.map(report => {
        const isMoiAussiActive = userVotes[`${report.id}_moi_aussi`] ? "active" : "";
        const formattedDate = formatDate(report.incident_date);
        const timeDisplay = report.incident_time ? report.incident_time.substring(0, 5) : "10:30";
        const catIconLabel = catIcons[report.category] || "Signalement";

        // Label statut
        const statusLabel = statusLabels[report.status] || report.status;
        const isNonConfirmed = (report.status === "recu" || report.status === "publie");

        // Lien Facebook si transmis
        const fbLink = (report.status === "transmis" && report.facebook_post_url)
            ? `<a href="${escapeHtml(report.facebook_post_url)}" target="_blank" rel="noopener" class="fb-post-link">📘 Voir le post Facebook</a>`
            : "";

        // Bouton WhatsApp
        const whatsappText = encodeURIComponent(
            `🇸🇳 SignalSN — Fait signalé : ${report.fact_type} à ${report.establishment_name || report.location_name} le ${formattedDate}. Voir sur SignalSN : https://signalsn.vercel.app`
        );
        const whatsappBtn = `<a href="https://wa.me/?text=${whatsappText}" target="_blank" rel="noopener" class="btn-whatsapp">Partager sur WhatsApp</a>`;

        // Catégories infos
        const catInfo = {
            voirie: { name: "Voirie", icon: "🚧", color: "#c2410c" },
            eau_electricite: { name: "Eau", icon: "💧", color: "#0284c7" },
            insalubrite: { name: "Insalubrité", icon: "🧹", color: "#dc2626" },
            sante: { name: "Santé", icon: "🏥", color: "#059669" },
            mairies_services: { name: "Mairie", icon: "🏛️", color: "#d97706" },
            securite: { name: "Sécurité", icon: "🛡️", color: "#7c3aed" }
        };
        const currentCat = catInfo[report.category] || { name: "Signalement", icon: "📍", color: "#0b6637" };

        // Calcul confirmation et barre de progression
        const count = report.moi_aussi_count || 1;
        const isConfirmed = report.status === "confirme" || report.status === "transmis" || report.status === "resolu" || count >= MOI_AUSSI_THRESHOLD;
        
        const progressPercent = isConfirmed ? 100 : Math.round((Math.min(count, 1) / MOI_AUSSI_THRESHOLD) * 100);
        const progressLabel = isConfirmed 
            ? `Confirmé par ${count} personnes`
            : `${Math.min(count, 1)} sur ${MOI_AUSSI_THRESHOLD} pour confirmer`;

        return `
            <div class="report-card cat-card-${report.category}" id="card-${report.id}" style="border-left: 4px solid ${currentCat.color};">
                
                <!-- En-tête avec rond icône et titre -->
                <div class="card-header-flex">
                    <div class="card-cat-badge" style="background: ${currentCat.color}18; color: ${currentCat.color};">
                        <span>${currentCat.icon}</span>
                    </div>
                    <div class="card-title-block">
                        <div class="report-card-title">
                            [${escapeHtml(report.establishment_name || report.location_name)}]
                        </div>
                        <div class="report-card-subtitle-compact">
                            ${currentCat.name} · ${escapeHtml(report.fact_type)} · [${formattedDate}] · [${timeDisplay}]
                        </div>
                    </div>
                </div>

                <!-- Jauge de progression de confirmation -->
                <div class="card-progress-section">
                    <div class="card-progress-label">${progressLabel}</div>
                    <div class="card-progress-track">
                        <div class="card-progress-bar" style="width: ${progressPercent}%;"></div>
                    </div>
                </div>
                
                <!-- Alignement 2 Lignes de boutons & pastilles -->
                <div class="card-dual-grid">
                    <!-- Ligne 1 : Statut à gauche | Bouton Moi aussi à droite -->
                    <div class="dual-row dual-row-1">
                        <div class="dual-col-left">
                            <span class="pill-status ${isConfirmed ? 'pill-confirme' : 'pill-non-confirmed'}">
                                ${isConfirmed ? 'Confirmé' : 'Non confirmé'}
                            </span>
                        </div>
                        <div class="dual-col-right">
                            <button class="card-action-btn btn-moi-aussi ${isMoiAussiActive}" onclick="handleMoiAussi('${report.id}')">
                                👁 Moi aussi j'ai vu
                            </button>
                        </div>
                    </div>

                    <!-- Conseil secours au-dessus du bouton ligne 2 en cas de danger -->
                    ${report.immediate_danger ? `
                        <div class="danger-call-center-notice">
                            Appelez d'abord les secours si vous êtes sur place.
                        </div>
                    ` : ''}
                    
                    <!-- Ligne 2 : Danger immédiat à gauche | Bouton WhatsApp à droite -->
                    <div class="dual-row dual-row-2">
                        <div class="dual-col-left">
                            ${report.immediate_danger ? `
                                <span class="pill-status pill-danger">Danger immédiat</span>
                            ` : ''}
                        </div>
                        <div class="dual-col-right">
                            <a href="https://wa.me/?text=${whatsappText}" target="_blank" rel="noopener" class="card-action-btn btn-whatsapp ${report.immediate_danger ? 'filled' : 'outlined'}">
                                Partager sur WhatsApp
                            </a>
                        </div>
                    </div>
                </div>
                
                ${fbLink}
                
                <div class="report-card-share-row">
                    <button class="link-signaler-contenu" onclick="openFlagModal('${report.id}')">
                        Signaler ce contenu
                    </button>
                </div>
            </div>
        `;
    }).join("");
}

function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[m]);
}

// --- 5. INTERACTION "MOI AUSSI J'AI VU" ---
const MOI_AUSSI_THRESHOLD = 2; // Paramétrable : nombre de "Moi aussi" pour confirmer

async function handleMoiAussi(reportId) {
    const userVotes = JSON.parse(localStorage.getItem("signalsn_user_votes") || "{}");
    const key = `${reportId}_moi_aussi`;
    
    if (userVotes[key]) {
        alert("Vous avez déjà confirmé avoir vu ce fait.");
        return;
    }
    
    userVotes[key] = true;
    localStorage.setItem("signalsn_user_votes", JSON.stringify(userVotes));
    
    if (supabaseClient) {
        try {
            // Incrémenter le compteur et récupérer la nouvelle valeur
            const { data: interaction } = await supabaseClient.from("report_interactions").insert({
                report_id: reportId,
                interaction: "moi_aussi",
                device_fingerprint: getDeviceFingerprint()
            }).select();

            // Récupérer le rapport pour vérifier le seuil de confirmation
            const { data: rep } = await supabaseClient
                .from("reports")
                .select("moi_aussi_count, status")
                .eq("id", reportId)
                .single();

            if (rep) {
                const newCount = (rep.moi_aussi_count || 0) + 1;
                const updates = { moi_aussi_count: newCount };

                // Auto-confirmation si seuil atteint et pas déjà confirmé
                if (newCount >= MOI_AUSSI_THRESHOLD && (rep.status === "recu" || rep.status === "publie")) {
                    updates.status = "confirme";
                    updates.is_publicly_visible = true;
                }

                await supabaseClient.from("reports").update(updates).eq("id", reportId);

                // Mise à jour visuelle du compteur
                const countEl = document.getElementById(`count-${reportId}`);
                if (countEl) countEl.textContent = newCount;
            }
        } catch (e) {
            console.error(e);
        }
    } else {
        // Mode démo : incrémenter localement et vérifier le seuil
        const rep = demoReports.find(r => r.id === reportId);
        if (rep) {
            rep.moi_aussi_count = (rep.moi_aussi_count || 0) + 1;
            if (rep.moi_aussi_count >= MOI_AUSSI_THRESHOLD && (rep.status === "recu" || rep.status === "publie")) {
                rep.status = "confirme";
            }
            const countEl = document.getElementById(`count-${reportId}`);
            if (countEl) countEl.textContent = rep.moi_aussi_count;
        }
    }
    
    // Rafraîchir la liste pour refléter le nouveau statut
    renderReportsList();
}

// --- 6. GESTION DU FORMULAIRE "SIGNALER UN FAIT" (CONFORME IMAGE 2) ---
const categorySelect = document.getElementById("category-select");
const establishmentSelect = document.getElementById("establishment-select");
const establishmentSelectWrap = document.getElementById("establishment-select-wrap");
const locationInput = document.getElementById("location-input");
const dynamicFieldsContainer = document.getElementById("dynamic-category-fields");
const btnTriggerPhoto = document.getElementById("btn-trigger-photo");
const photoInput = document.getElementById("photo-input");
const catTiles = document.querySelectorAll(".cat-tile");
const roleSegmentBtns = document.querySelectorAll(".role-segment-btn");
const roleInput = document.getElementById("reporter-role-input");

btnTriggerPhoto.addEventListener("click", () => photoInput.click());

// Gestion des tuiles de catégorie
catTiles.forEach(tile => {
    tile.addEventListener("click", () => {
        catTiles.forEach(t => t.classList.remove("active"));
        tile.classList.add("active");
        const selectedCat = tile.getAttribute("data-cat");
        if (categorySelect) categorySelect.value = selectedCat;
        renderDynamicCategoryFields(selectedCat);
    });
});

// Gestion des segments de rôle
roleSegmentBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        roleSegmentBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const role = btn.getAttribute("data-role");
        if (roleInput) roleInput.value = role;
    });
});

function populateEstablishmentDropdown(filterCat = null) {
    if (!establishmentSelect) return;
    
    let list = liveEstablishments;
    if (filterCat === "sante") {
        list = liveEstablishments.filter(e => e.category === "hopital" || e.category === "centre_sante");
    } else if (filterCat === "mairies_services") {
        list = liveEstablishments.filter(e => e.category === "mairie" || e.category === "service_public");
    }
    
    establishmentSelect.innerHTML = `<option value="">Choisir un établissement</option>` + list.map(e => `
        <option value="${e.id}" data-lat="${e.latitude}" data-lng="${e.longitude}" data-name="${e.name}">
            ${e.name} (${e.commune})
        </option>
    `).join("");
}

function renderDynamicCategoryFields(category) {
    populateEstablishmentDropdown(category);
    
    if (category === "insalubrite" || category === "voirie" || category === "eau_electricite" || category === "securite") {
        establishmentSelectWrap.style.display = "none";
        freeLocationWrap.style.display = "block";
        locationInput.required = true;
        
        if (category === "voirie") {
            locationInput.placeholder = "Lieu précis ou axe routier (Ex: VDN Échangeur Foire, RN1 Rufisque)...";
        } else if (category === "eau_electricite") {
            locationInput.placeholder = "Lieu précis (Quartier, rue, borne fontaine)...";
        } else if (category === "insalubrite") {
            locationInput.placeholder = "Lieu précis (Croisement, rue, près de l'école)...";
        }
    } else {
        establishmentSelectWrap.style.display = "block";
        freeLocationWrap.style.display = "none";
        locationInput.required = false;
    }
    
    // 6. Routes et voirie
    if (category === "voirie") {
        dynamicFieldsContainer.innerHTML = `
            <div class="field-group">
                <label class="field-label">Type d'anomalie de voirie *</label>
                <select id="fact-type-select" class="field-select" required>
                    <option value="Nid-de-poule">Nid-de-poule dangereux</option>
                    <option value="Route dégradée">Route dégradée / Chaussée défoncée</option>
                    <option value="Inondation chaussée">Inondation de la chaussée</option>
                    <option value="Éclairage public en panne">Éclairage public en panne</option>
                    <option value="Signalisation absente ou endommagée">Signalisation absente ou endommagée</option>
                    <option value="Trottoir ou caniveau cassé">Trottoir ou caniveau cassé</option>
                </select>
            </div>
            <div class="field-group">
                <label class="field-label">Commune *</label>
                <input type="text" id="commune-input" class="field-input" placeholder="Ex: Grand Yoff, Rufisque, Parcelles Assainies..." required>
            </div>
            <div class="field-group">
                <label style="font-size: 0.84rem; display: flex; align-items: center; gap: 6px; color: var(--sn-red); font-weight: 600;">
                    <input type="checkbox" id="immediate-danger-checkbox"> ⚠️ Danger immédiat pour les usagers
                </label>
            </div>
        `;
    }
    
    // 7. Eau et électricité
    else if (category === "eau_electricite") {
        dynamicFieldsContainer.innerHTML = `
            <div class="field-group">
                <label class="field-label">Type de fait *</label>
                <select id="fact-type-select" class="field-select" required onchange="toggleCoupureDuration(this.value)">
                    <option value="Fuite d'eau sur voie publique">Fuite d'eau importante sur la voie publique</option>
                    <option value="Poteau ou câble dangereux">Poteau penché ou câble dénudé dangereux</option>
                    <option value="Coupure d'eau">Coupure d'eau</option>
                    <option value="Coupure d'électricité">Coupure d'électricité</option>
                    <option value="Eau non potable constatée">Eau non potable constatée (couleur / odeur)</option>
                    <option value="Compteur ou borne-fontaine HS">Compteur ou borne-fontaine hors service</option>
                </select>
            </div>
            <div class="field-group" id="coupure-duration-group" style="display: none;">
                <label class="field-label">Durée constatée de la coupure</label>
                <select id="duration-input" class="field-select">
                    <option value="Moins de 2h">Moins de 2 heures</option>
                    <option value="2h à 6h">2h à 6 heures</option>
                    <option value="6h à 24h">6h à 24 heures</option>
                    <option value="Plus de 24h">Plus de 24 heures</option>
                </select>
            </div>
            <div class="field-group">
                <label style="font-size: 0.84rem; display: flex; align-items: center; gap: 6px; color: var(--sn-red); font-weight: 600;">
                    <input type="checkbox" id="immediate-danger-checkbox"> ⚠️ Danger immédiat (câble à terre, étincelles...)
                </label>
            </div>
            <p class="field-disclaimer">ℹ️ Les faits portent sur le lieu et le service. Les noms des opérateurs ne sont jamais publiés.</p>
        `;
    }
    
    // 1. Insalubrité (sans câble dénudé, déplacé en eau_electricite)
    else if (category === "insalubrite") {
        dynamicFieldsContainer.innerHTML = `
            <div class="field-group">
                <label class="field-label">Type d'anomalie *</label>
                <select id="fact-type-select" class="field-select" required>
                    <option value="Déchets">Déchets / Dépôt sauvage d'ordures</option>
                    <option value="Fissure / Risque effondrement">Fissure ou bâtiment menaçant ruine</option>
                    <option value="Eau stagnante">Eau stagnante / Moustiques / Eaux usées</option>
                    <option value="Caniveau ou bouche d'égout ouverte">Caniveau ou bouche d'égout à ciel ouvert</option>
                </select>
            </div>
            <div class="field-group">
                <label style="font-size: 0.84rem; display: flex; align-items: center; gap: 6px; color: var(--sn-red); font-weight: 600;">
                    <input type="checkbox" id="immediate-danger-checkbox"> ⚠️ Danger immédiat pour la sécurité
                </label>
            </div>
        `;
    }
    
    // 2. Santé
    else if (category === "sante") {
        dynamicFieldsContainer.innerHTML = `
            <div class="field-group">
                <label class="field-label">Type de fait constaté *</label>
                <select id="fact-type-select" class="field-select" required>
                    <option value="Personnel absent">Personnel absent / Non-respect des gardes</option>
                    <option value="Matériel d'urgence en panne">Matériel d'urgence en panne (Scanner, Radio...)</option>
                    <option value="Attente excessive (> 3h)">Attente excessive (> 3 heures constatées)</option>
                    <option value="Rupture de produit d'urgence">Rupture de médicament / produit de réanimation</option>
                    <option value="Négligence matérielle">Négligence matérielle ou d'hygiène</option>
                </select>
            </div>
        `;
    }
    
    // 3. Mairies & services
    else if (category === "mairies_services") {
        dynamicFieldsContainer.innerHTML = `
            <div class="field-group">
                <label class="field-label">Type de fait administratif *</label>
                <select id="fact-type-select" class="field-select" required>
                    <option value="Fermé aux heures affichées">Fermé aux heures affichées</option>
                    <option value="Agent absent au guichet">Agent absent au guichet sans explication</option>
                    <option value="Service refusé sans motif">Dossier refusé sans motif légal</option>
                    <option value="Paiement sans reçu">Demande de paiement sans délivrance de reçu</option>
                </select>
            </div>
        `;
    }
    
    // 4. Sécurité
    else if (category === "securite") {
        dynamicFieldsContainer.innerHTML = `
            <div class="field-group">
                <label class="field-label">Type d'incident *</label>
                <select id="fact-type-select" class="field-select" required>
                    <option value="Vol à l'arraché">Vol à l'arraché (Scooter / Piéton)</option>
                    <option value="Agression voie publique">Agression sur voie publique</option>
                    <option value="Zone sans éclairage">Zone sans éclairage / Insécurité nocturne</option>
                </select>
            </div>
        `;
    } else {
        dynamicFieldsContainer.innerHTML = "";
    }
}

// GPS
const btnGps = document.getElementById("btn-gps");
const gpsStatus = document.getElementById("gps-status");

btnGps.addEventListener("click", () => {
    if (!navigator.geolocation) {
        gpsStatus.textContent = "GPS indisponible";
        return;
    }
    gpsStatus.textContent = "Recherche...";
    navigator.geolocation.getCurrentPosition(
        pos => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            document.getElementById("lat-input").value = lat;
            document.getElementById("lng-input").value = lng;
            gpsStatus.textContent = `Position acquise (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
            gpsStatus.style.color = "var(--primary-green)";
        },
        err => {
            gpsStatus.textContent = "Accès refusé";
            gpsStatus.style.color = "var(--sn-red)";
        },
        { enableHighAccuracy: true, timeout: 8000 }
    );
});

// Compression photo Canvas (< 300 Ko)
let compressedPhotoData = null;
photoInput.addEventListener("change", function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const previewContainer = document.getElementById("photo-preview-container");
    const previewImg = document.getElementById("photo-preview");
    const compressionInfo = document.getElementById("photo-compression-info");
    
    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            const MAX = 1200;
            let width = img.width;
            let height = img.height;
            if (width > height && width > MAX) {
                height *= MAX / width;
                width = MAX;
            } else if (height > MAX) {
                width *= MAX / height;
                height = MAX;
            }
            
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, width, height);
            
            compressedPhotoData = canvas.toDataURL("image/jpeg", 0.7);
            const sizeKb = Math.round((compressedPhotoData.length * 3 / 4) / 1024);
            
            previewImg.src = compressedPhotoData;
            compressionInfo.textContent = `Photo prête (${sizeKb} Ko)`;
            previewContainer.style.display = "block";
            btnTriggerPhoto.textContent = "✓ Photo sélectionnée";
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

// Description factuelle & compteur 500
const descInput = document.getElementById("description-input");
const charCount = document.getElementById("char-count");
const filterWarning = document.getElementById("filter-warning");
const SENSITIVE_WORDS = ["docteur", "dr.", "directeur", "monsieur", "madame", "mme", "m.", "voleur", "escroc", "menteur"];

descInput.addEventListener("input", (e) => {
    const val = e.target.value;
    charCount.textContent = val.length;
    const lower = val.toLowerCase();
    const hasSensitive = SENSITIVE_WORDS.some(w => lower.includes(w));
    filterWarning.style.display = hasSensitive ? "block" : "none";
});

// Envoi du signalement
const reportForm = document.getElementById("report-form");
reportForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const submitBtn = document.getElementById("btn-submit-report");
    submitBtn.disabled = true;
    submitBtn.textContent = "Envoi en cours...";
    
    const category = categorySelect.value;
    const factTypeSelect = document.getElementById("fact-type-select");
    const factType = factTypeSelect ? factTypeSelect.value : "Anomalie constatée";
    
    let establishmentId = null;
    let establishmentName = null;
    let locationName = locationInput.value;
    let lat = parseFloat(document.getElementById("lat-input").value) || null;
    let lng = parseFloat(document.getElementById("lng-input").value) || null;
    
    if (category === "sante" || category === "mairies_services") {
        const selectedOpt = establishmentSelect.selectedOptions[0];
        if (selectedOpt && selectedOpt.value) {
            establishmentId = selectedOpt.value;
            establishmentName = selectedOpt.getAttribute("data-name");
            locationName = establishmentName;
            lat = lat || parseFloat(selectedOpt.getAttribute("data-lat"));
            lng = lng || parseFloat(selectedOpt.getAttribute("data-lng"));
        }
    }
    
    const dangerCheckbox = document.getElementById("immediate-danger-checkbox");
    const immediateDanger = dangerCheckbox ? dangerCheckbox.checked : false;
    
    let roleVal = "present";
    const roleHidden = document.getElementById("reporter-role-input");
    if (roleHidden) {
        roleVal = roleHidden.value;
    } else {
        const checkedRole = document.querySelector('input[name="reporter_role"]:checked');
        if (checkedRole) roleVal = checkedRole.value;
    }

    let dateVal = document.getElementById("incident-date").value;
    // Conversion si format JJ/MM/AAAA vers AAAA-MM-JJ pour Supabase
    if (dateVal && dateVal.includes("/")) {
        const dparts = dateVal.split("/");
        if (dparts.length === 3) dateVal = `${dparts[2]}-${dparts[1]}-${dparts[0]}`;
    }
    
    const newReport = {
        category,
        status: 'recu',
        establishment_id: establishmentId,
        location_name: locationName || establishmentName || "Lieu non précisé",
        latitude: lat || 14.6937,
        longitude: lng || -17.4441,
        incident_date: dateVal || new Date().toISOString().split("T")[0],
        incident_time: document.getElementById("incident-time").value || null,
        fact_type: factType,
        immediate_danger: immediateDanger,
        factual_description: descInput.value,
        photo_url: compressedPhotoData,
        reporter_role: roleVal,
        device_fingerprint: getDeviceFingerprint(),
        is_publicly_visible: true,
        moi_aussi_count: 1,
        created_at: new Date().toISOString()
    };
    
    if (supabaseClient) {
        try {
            const { error } = await supabaseClient.from("reports").insert([newReport]);
            if (error) {
                console.error("Erreur Supabase:", error);
                alert("❌ Erreur lors de l'envoi : " + error.message + "\nVeuillez réessayer ou contacter l'équipe SignalSN.");
                submitBtn.disabled = false;
                submitBtn.textContent = "Envoyer le signalement";
                return;
            }
        } catch (err) {
            console.error("Erreur réseau:", err);
            alert("❌ Erreur réseau. Vérifiez votre connexion et réessayez.");
            submitBtn.disabled = false;
            submitBtn.textContent = "Envoyer le signalement";
            return;
        }
    } else {
        demoReports.unshift({ id: "rep-" + Date.now(), ...newReport });
    }
    
    const isPendingRecoupement = (category === "sante" || (category === "eau_electricite" && factType.includes("Coupure")));
    alert(isPendingRecoupement 
        ? "Signalement reçu. Il sera visible publiquement après recoupement de plusieurs signalements concordants."
        : "Signalement enregistré avec succès.");
        
    reportForm.reset();
    compressedPhotoData = null;
    document.getElementById("photo-preview-container").style.display = "none";
    btnTriggerPhoto.textContent = "📷 Ajouter une photo";
    submitBtn.disabled = false;
    submitBtn.textContent = "Envoyer le signalement";
    
    document.querySelector('.bottom-nav-item[data-target="view-feed"]').click();
});

// Toggle durée de coupure
window.toggleCoupureDuration = function(val) {
    const group = document.getElementById("coupure-duration-group");
    if (group) {
        group.style.display = (val === "Coupure d'eau" || val === "Coupure d'électricité") ? "block" : "none";
    }
};

// --- 7. STATISTIQUES PAR ÉTABLISSEMENT / SECTEUR ---
const statFilterButtons = document.querySelectorAll("#view-stats .filter-btn");
statFilterButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        statFilterButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentStatFilter = btn.getAttribute("data-stat-cat");
        loadEstablishmentStats();
    });
});

async function loadEstablishmentStats() {
    const cardsContainer = document.getElementById("establishments-cards-container");
    const totalEl = document.getElementById("stat-total-reports");
    const confirmedEl = document.getElementById("stat-confirmed-count");
    const resolvedRateEl = document.getElementById("stat-resolved-rate");
    
    const reports = await fetchReports();
    
    let categoryReports = reports;
    if (currentStatFilter === "insalubrite") {
        categoryReports = reports.filter(r => r.category === "insalubrite");
    } else if (currentStatFilter === "voirie") {
        categoryReports = reports.filter(r => r.category === "voirie");
    } else if (currentStatFilter === "eau_electricite") {
        categoryReports = reports.filter(r => r.category === "eau_electricite");
    } else if (currentStatFilter === "hopital") {
        categoryReports = reports.filter(r => r.category === "sante");
    } else if (currentStatFilter === "mairie") {
        categoryReports = reports.filter(r => r.category === "mairies_services");
    }
    
    totalEl.textContent = categoryReports.length;
    const confirmedCount = categoryReports.filter(r => r.status === "confirme" || r.status === "transmis" || r.status === "resolu").length;
    if (confirmedEl) confirmedEl.textContent = confirmedCount;
    const resolvedCount = categoryReports.filter(r => r.status === "resolu").length;
    const rate = categoryReports.length > 0 ? Math.round((resolvedCount / categoryReports.length) * 100) : 0;
    resolvedRateEl.textContent = rate + "%";
    
    let rowsData = [];
    
    const iconByCat = {
        sante: "🏥",
        hopital: "🏥",
        mairie: "🏛️",
        mairies_services: "🏛️",
        voirie: "🚧",
        eau_electricite: "💧",
        insalubrite: "🧹"
    };

    // Agrégation par lieu / commune pour insalubrité, voirie ou eau/électricité
    if (currentStatFilter === "insalubrite" || currentStatFilter === "voirie" || currentStatFilter === "eau_electricite") {
        const mapZones = {};
        categoryReports.forEach(r => {
            const loc = r.location_name || "Zone non spécifiée";
            if (!mapZones[loc]) mapZones[loc] = { name: loc, count: 0, confirmed: 0, resolved: 0, icon: iconByCat[r.category] || "📍" };
            mapZones[loc].count++;
            if (r.status === "confirme" || r.status === "transmis" || r.status === "resolu") mapZones[loc].confirmed++;
            if (r.status === "resolu") mapZones[loc].resolved++;
        });
        rowsData = Object.values(mapZones);
    } else {
        let filteredList = liveEstablishments;
        if (currentStatFilter === "hopital") {
            filteredList = liveEstablishments.filter(e => e.category === "hopital" || e.category === "centre_sante");
        } else if (currentStatFilter === "mairie") {
            filteredList = liveEstablishments.filter(e => e.category === "mairie" || e.category === "service_public");
        }
        
        rowsData = filteredList.map(est => {
            const estReports = reports.filter(r => r.establishment_name === est.name || (r.establishment_id && r.establishment_id === est.id));
            const estCount = estReports.length;
            const estConfirmed = estReports.filter(r => r.status === "confirme" || r.status === "transmis" || r.status === "resolu").length;
            const estResolved = estReports.filter(r => r.status === "resolu").length;
            const icon = est.category === "mairie" ? "🏛️" : (est.category === "hopital" ? "🏥" : "📍");
            return {
                name: est.name,
                count: estCount,
                confirmed: estConfirmed,
                resolved: estResolved,
                icon: icon
            };
        });
        
        if (currentStatFilter === "all") {
            const nonEstReports = reports.filter(r => r.category === "insalubrite" || r.category === "voirie" || r.category === "eau_electricite");
            const mapZones = {};
            nonEstReports.forEach(r => {
                const loc = r.location_name || "Zone non spécifiée";
                if (!mapZones[loc]) mapZones[loc] = { name: loc, count: 0, confirmed: 0, resolved: 0, icon: iconByCat[r.category] || "📍" };
                mapZones[loc].count++;
                if (r.status === "confirme" || r.status === "transmis" || r.status === "resolu") mapZones[loc].confirmed++;
                if (r.status === "resolu") mapZones[loc].resolved++;
            });
            rowsData = [...rowsData, ...Object.values(mapZones)];
        }
    }
    
    rowsData.sort((a, b) => b.count - a.count);
    
    if (!cardsContainer) return;

    if (rowsData.length === 0) {
        cardsContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 25px; border: 1px dashed var(--border-color); border-radius: var(--radius-md);">Aucun signalement dans cette catégorie.</div>`;
        return;
    }

    cardsContainer.innerHTML = rowsData.slice(0, 10).map(item => {
        const estResolvedPct = item.count > 0 ? Math.round((item.resolved / item.count) * 100) : 0;
        const confirmedPct = item.count > 0 ? Math.min(100, Math.round((item.confirmed / item.count) * 100)) : 0;
        
        return `
            <div class="stat-est-card">
                <div class="stat-card-header">
                    <div class="stat-card-title-wrap">
                        <div class="stat-cat-icon">${item.icon}</div>
                        <div class="stat-est-name">[${escapeHtml(item.name)}]</div>
                    </div>
                    <div class="stat-est-count">
                        <strong>${item.count}</strong>
                        <span>signalements</span>
                    </div>
                </div>
                
                <div class="stat-card-subinfo">
                    <span>Confirmés [${item.confirmed}]</span>
                    <span>Résolus [${estResolvedPct}%]</span>
                </div>
                
                <!-- Double barre bicolore verte -->
                <div class="stat-dual-progress-track">
                    <div class="stat-progress-bar-confirmed" style="width: ${confirmedPct}%;"></div>
                    <div class="stat-progress-bar-resolved" style="width: ${estResolvedPct}%;"></div>
                </div>
            </div>
        `;
    }).join("");
}

// --- 8. CARTE LEAFLET AVEC REGROUPEMENT (CLUSTERING) ---
function initOrRefreshMap() {
    const mapContainer = document.getElementById("map-container");
    if (!mapContainer) return;
    
    if (!mapInstance) {
        mapInstance = L.map('map-container').setView([14.7167, -17.4333], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap Sénégal | SignalSN',
            maxZoom: 18
        }).addTo(mapInstance);
    } else {
        mapInstance.invalidateSize();
    }
    
    if (markerClusterGroup) {
        mapInstance.removeLayer(markerClusterGroup);
        markerClusterGroup = null;
    }
    
    if (typeof L.markerClusterGroup === 'function') {
        markerClusterGroup = L.markerClusterGroup({ maxClusterRadius: 45, spiderfyOnMaxZoom: true });
    }
    
    const catColors = {
        voirie: "#ea580c",        // Orange voirie
        eau_electricite: "#0284c7",// Bleu eau/élec
        sante: "#059669",          // Vert santé
        insalubrite: "#dc2626",    // Rouge insalubrité
        mairies_services: "#ca8a04",// Jaune mairies
        securite: "#7c3aed"        // Violet sécurité
    };

    fetchReports().then(reports => {
        reports.forEach(r => {
            if (r.latitude && r.longitude) {
                const color = catColors[r.category] || "#0b6637";
                const marker = L.circleMarker([r.latitude, r.longitude], {
                    radius: 8,
                    fillColor: color,
                    color: "#ffffff",
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.85
                });
                marker.bindPopup(`<strong>${escapeHtml(r.establishment_name || r.location_name)}</strong><br>${escapeHtml(r.fact_type)}`);
                
                if (markerClusterGroup) {
                    markerClusterGroup.addLayer(marker);
                } else {
                    marker.addTo(mapInstance);
                }
            }
        });
        if (markerClusterGroup) mapInstance.addLayer(markerClusterGroup);
    });
}

// --- 9. MODALES CHARTE & SIGNALEMENT CONTENU ---
const modalFlag = document.getElementById("modal-flag");
const flagForm = document.getElementById("flag-form");
const btnCancelFlag = document.getElementById("btn-cancel-flag");

function openFlagModal(reportId) {
    document.getElementById("flag-report-id").value = reportId;
    modalFlag.style.display = "flex";
}

btnCancelFlag.addEventListener("click", () => modalFlag.style.display = "none");

flagForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const reportId = document.getElementById("flag-report-id").value;
    const reason = document.getElementById("flag-reason").value;
    
    if (supabaseClient) {
        try {
            await supabaseClient.from("content_flags").insert({
                report_id: reportId,
                reason,
                reporter_device: getDeviceFingerprint()
            });
        } catch (err) {
            console.error(err);
        }
    }
    alert("Demande de retrait transmise. Elle sera traitée sous 24h.");
    modalFlag.style.display = "none";
});

const modalInfo = document.getElementById("modal-info");
const btnCloseInfo = document.getElementById("btn-close-info");
function openInfoModal() { modalInfo.style.display = "flex"; }
function openLegalModal(type) { alert(`Section ${type} : En conformité avec la législation sénégalaise relative à la protection des données et à la liberté de communication.`); }
btnCloseInfo.addEventListener("click", () => modalInfo.style.display = "none");

window.addEventListener("click", (e) => {
    if (e.target === modalFlag) modalFlag.style.display = "none";
    if (e.target === modalInfo) modalInfo.style.display = "none";
});

// Chargement initial
document.addEventListener("DOMContentLoaded", () => {
    syncCurrentDateTime();
    renderReportsList();
});
