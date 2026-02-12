/**
 * Supabase Client Singleton
 * 
 * This module ensures only ONE Supabase client instance exists across the entire app.
 * All files should use window.getSupabaseClient() instead of calling createClient() directly.
 * 
 * Usage:
 *   const client = window.getSupabaseClient();
 *   // or
 *   const client = window.__supabaseInstance;
 */

// Configuration
const SUPABASE_URL = 'https://rkhkvmcnjuwoxammhsqn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJraGt2bWNuanV3b3hhbW1oc3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzODk0MjcsImV4cCI6MjA4NTk2NTQyN30.iGTVKa7iap8MLZ8v0efCvzsqzviNBbacVfEDxQGDsZQ';

// Singleton instance
let supabaseInstance = null;

/**
 * Get the singleton Supabase client instance
 * Creates it on first call, returns existing instance on subsequent calls
 */
function getSupabaseClient() {
    if (supabaseInstance) {
        return supabaseInstance;
    }
    
    // Check if already created globally (for cross-script compatibility)
    if (window.__supabaseInstance) {
        supabaseInstance = window.__supabaseInstance;
        return supabaseInstance;
    }
    
    // Create the single instance
    if (typeof window.supabase === 'undefined') {
        console.error('❌ Supabase SDK not loaded. Make sure to include the SDK script before this file.');
        return null;
    }
    
    supabaseInstance = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Store globally for cross-script access
    window.__supabaseInstance = supabaseInstance;
    
    console.log('✅ Supabase client initialized (singleton)');
    
    return supabaseInstance;
}

// Attach to window for universal access
window.getSupabaseClient = getSupabaseClient;
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

// Auto-initialize on load (for scripts that just include this file)
if (typeof window.supabase !== 'undefined') {
    getSupabaseClient();
}