// Khedmati - Customer Dashboard v3 (Debug Version)
const SUPABASE_URL = 'https://rkhkvmcnjuwoxammhsqn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJraGt2bWNuanV3b3hhbW1oc3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzODk0MjcsImV4cCI6MjA4NTk2NTQyN30.iGTVKa7iap8MLZ8v0efCvzsqzviNBbacVfEDxQGDsZQ';

if (typeof window.supabase === 'undefined') {
    alert('Critical Error: Supabase not loaded.');
}

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabaseClient = supabaseClient;

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Check Auth
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }
    currentUser = session.user;

    console.log('--- DEBUG INFO ---');
    console.log('User ID:', currentUser.id);
    console.log('User Email:', currentUser.email);

    // 2. Load Profile
    const { data: profile } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

    console.log('Profile:', profile);

    if (profile) {
        document.getElementById('userName').textContent = profile.full_name || 'Client';
    }

    // 3. DEBUG: Check bookings with simple query
    console.log('Fetching bookings...');

    const { data: bookings, error } = await supabaseClient
        .from('bookings')
        .select('*');
    // REMOVED .eq('customer_id') to see if ANY return (RLS should filter)

    console.log('Bookings found:', bookings);
    console.log('Error:', error);

    if (bookings && bookings.length > 0) {
        alert(`Found ${bookings.length} bookings! Check console for details.`);
        renderBookings(bookings);
    } else {
        alert('No bookings found. Checking specific ID...');
        // Try strict ID check
        const { data: bookingsStrict } = await supabaseClient
            .from('bookings')
            .select('*')
            .eq('customer_id', currentUser.id);
        console.log('Strict ID Check:', bookingsStrict);

        if (bookingsStrict && bookingsStrict.length > 0) {
            renderBookings(bookingsStrict);
        } else {
            document.getElementById('pendingBookingsList').innerHTML = '<p style="color:red">No bookings found for ID: ' + currentUser.id + '</p>';
        }
    }
});

function renderBookings(bookings) {
    const list = document.getElementById('pendingBookingsList');
    list.innerHTML = bookings.map(b => `
        <div style="border:1px solid #ccc; padding:10px; margin:5px;">
            <h3>Booking ID: ${b.id}</h3>
            <p>Provider ID: ${b.provider_id}</p>
            <p>Status: ${b.status}</p>
        </div>
    `).join('');
}
