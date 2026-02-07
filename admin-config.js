// =============================================
// ADMIN CONFIGURATION
// For testing and development
// =============================================

const ADMIN_CONFIG = {
    // Toggle this to bypass verification during testing
    BYPASS_VERIFICATION: true,

    // Auto-verify new providers when bypass is enabled
    AUTO_VERIFY_NEW_PROVIDERS: true,

    // Admin user IDs (can bypass verification checks)
    ADMIN_USER_IDS: [
        // Add your user ID here for admin access
        // Example: '123e4567-e89b-12d3-a456-426614174000'
    ],

    // Minimum reviews required to show rating
    MIN_REVIEWS_FOR_RATING: 1,

    // Development mode (shows extra debug info)
    DEV_MODE: true
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ADMIN_CONFIG;
}

// Make available globally
window.ADMIN_CONFIG = ADMIN_CONFIG;

// Helper function to check if user is admin
function isAdmin(userId) {
    return ADMIN_CONFIG.ADMIN_USER_IDS.includes(userId);
}

// Helper function to check if provider should be auto-verified
function shouldAutoVerify() {
    return ADMIN_CONFIG.BYPASS_VERIFICATION && ADMIN_CONFIG.AUTO_VERIFY_NEW_PROVIDERS;
}

console.log('🔧 Admin Config Loaded:', {
    bypass: ADMIN_CONFIG.BYPASS_VERIFICATION,
    autoVerify: ADMIN_CONFIG.AUTO_VERIFY_NEW_PROVIDERS,
    devMode: ADMIN_CONFIG.DEV_MODE
});
