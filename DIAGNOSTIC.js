// DIAGNOSTIC SCRIPT - Run this in browser console on dashboard.html
console.log('=== DASHBOARD DIAGNOSTIC ===');
console.log('Current URL:', window.location.href);

// Check Supabase
if (window.supabase) {
    const client = window.supabase.createClient(
        'https://rkhkvmcnjuwoxammhsqn.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJraGt2bWNuanV3b3hhbW1oc3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzODk0MjcsImV4cCI6MjA4NTk2NTQyN30.iGTVKa7iap8MLZ8v0efCvzsqzviNBbacVfEDxQGDsZQ'
    );

    client.auth.getSession().then(({ data: { session } }) => {
        console.log('Session exists:', !!session);
        if (session) {
            console.log('User ID:', session.user.id);
            console.log('User Email:', session.user.email);

            // Check profile
            client.from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single()
                .then(({ data: profile, error }) => {
                    console.log('Profile:', profile);
                    console.log('Profile Error:', error);
                });

            // Check provider
            client.from('providers')
                .select('*')
                .eq('user_id', session.user.id)
                .single()
                .then(({ data: provider, error }) => {
                    console.log('Provider:', provider);
                    console.log('Provider Error:', error);
                });
        }
    });
} else {
    console.error('Supabase not loaded!');
}

// Check dashboard.js version (add version marker to know which version is loaded)
console.log('Dashboard.js loaded:', typeof checkAuth !== 'undefined');
