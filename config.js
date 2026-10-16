// ==============================================================================
// Configuration Supabase & Application SignaSN
// ==============================================================================

const CONFIG = {
    // URL de ton projet Supabase
    SUPABASE_URL: "https://kijvxagrcztufresgfoy.supabase.co",

    // Clé publique publishable / anon Supabase
    SUPABASE_ANON_KEY: "sb_publishable_kumufMO16KZ--ckMMNgACQ_jcAzxSbh",

    // Nom de l'application
    APP_NAME: "SignaSN",
    
    // Switch de fonctionnalités V1
    FEATURES: {
        COMMENTS_ENABLED: false, // Désactivé en V1 comme convenu
        PHOTO_COMPRESSION: true,
        MAX_PHOTO_SIZE_KB: 300,
        MAX_DESCRIPTION_LENGTH: 500
    }
};

// Stockage ou récupération d'un identifiant unique anonymisé pour cet appareil
function getDeviceFingerprint() {
    let fp = localStorage.getItem("signasn_device_fp");
    if (!fp) {
        fp = "dev_" + Math.random().toString(36).substring(2, 15) + "_" + Date.now().toString(36);
        localStorage.setItem("signasn_device_fp", fp);
    }
    return fp;
}
