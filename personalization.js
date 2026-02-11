// Append Personalization Logic to the end of customer-dashboard-v3.js

// Ensure CSS for horizontal scroll is present
const scrollStyle = document.createElement('style');
scrollStyle.textContent = `
    .personalization-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        margin-bottom: 30px;
    }
    .personalization-grid > .dashboard-card {
        padding: 20px;
        border-radius: 12px;
    }
    .horizontal-scroll-list { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px; }
    .horizontal-scroll-list::-webkit-scrollbar { height: 5px; }
    .horizontal-scroll-list::-webkit-scrollbar-thumb { background: #ccc; border-radius: 3px; }
    .horizontal-scroll-list .reorder-card,
    .horizontal-scroll-list .popular-card {
        min-width: 130px;
        max-width: 150px;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        padding: 12px 10px;
        text-align: center;
        background: white;
        transition: transform 0.2s, box-shadow 0.2s;
        cursor: pointer;
        flex-shrink: 0;
    }
    .horizontal-scroll-list .reorder-card:hover,
    .horizontal-scroll-list .popular-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .card-img {
        width: 44px; height: 44px;
        background: linear-gradient(135deg, #0d9488, #2dd4bf);
        color: white;
        border-radius: 50%;
        margin: 0 auto 8px;
        display: flex; align-items: center; justify-content: center;
        font-size: 1.2rem; font-weight: 700;
    }
    .card-title { font-size: 0.85rem; font-weight: 600; margin-bottom: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #111827; }
    .card-subtitle { font-size: 0.75rem; color: #6b7280; }
    .card-action { margin-top: 6px; font-size: 0.78rem; color: var(--primary, #0d9488); font-weight: 600; }
    /* Dark mode inner cards */
    [data-theme="dark"] .horizontal-scroll-list .reorder-card,
    [data-theme="dark"] .horizontal-scroll-list .popular-card {
        background: #111827 !important;
        border-color: #374151 !important;
    }
    [data-theme="dark"] .card-title { color: #f1f5f9 !important; }
    [data-theme="dark"] .card-subtitle { color: #9ca3af !important; }
    [data-theme="dark"] .card-action { color: #2dd4bf !important; }
    [data-theme="dark"] .card-img { background: linear-gradient(135deg, #0d9488, #115e59) !important; }
    @media (max-width: 768px) {
        .personalization-grid { grid-template-columns: 1fr; }
    }
`;
document.head.appendChild(scrollStyle);

// Load Personalization Data
async function loadPersonalization() {
    if (!currentUser) return;

    await Promise.all([loadReorderList(), loadPopularList()]);
}

// 1. Reorder Logic: Fetch previous unique providers
async function loadReorderList() {
    const list = document.getElementById('reorderList');
    const loading = document.getElementById('reorderLoading');

    // Fetch last 10 bookings
    const { data: bookings } = await supabaseClient
        .from('bookings')
        .select(`
            provider_id,
            providers (id, name, specialty)
        `)
        .eq('customer_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(10);

    loading.style.display = 'none';

    if (!bookings || bookings.length === 0) {
        list.innerHTML = '<p style="color:#888; padding:10px;">لم تقم بأي حجز بعد. ابدأ الآن!</p>';
        return;
    }

    // Unique providers
    const unique = [];
    const seen = new Set();
    bookings.forEach(b => {
        if (!b.providers) return;
        if (!seen.has(b.provider_id)) {
            seen.add(b.provider_id);
            unique.push(b.providers);
        }
    });

    list.innerHTML = unique.slice(0, 5).map(p => `
        <div class="reorder-card" onclick="window.location.href='booking.html?provider_id=${p.id}'">
            <div class="card-img">${p.name.charAt(0)}</div>
            <div class="card-title">${p.name}</div>
            <div class="card-subtitle">${p.specialty}</div>
            <div class="card-action">اطلب مجدداً ↺</div>
        </div>
    `).join('');
}

// 2. Popular Logic: Fetch providers with high ratings (optionally filtered by city)
async function loadPopularList() {
    const list = document.getElementById('popularList');
    const loading = document.getElementById('popularLoading');

    // Get user profile for location (optional, fallback to generic)
    const { data: profile } = await supabaseClient
        .from('profiles')
        .select('city')
        .eq('id', currentUser.id)
        .single();

    let query = supabaseClient
        .from('providers')
        .select('id, name, specialty, rating, city')
        .order('rating', { ascending: false })
        .limit(5);

    // If user has city, filter by it (Personalization!)
    if (profile && profile.city) {
        // We'll prioritize city, but for now strict filter
        // query = query.eq('city', profile.city); 
        // Strict filter might return empty if no providers in that city. 
        // Let's stick to simple top rated first for Phase 3 MVP.
    }

    const { data: providers } = await query;

    loading.style.display = 'none';

    if (!providers || providers.length === 0) {
        list.innerHTML = '<p style="color:#888;">لا يوجد مقدمي خدمات حالياً.</p>';
        return;
    }

    list.innerHTML = providers.map(p => `
        <div class="popular-card" onclick="window.location.href='provider-profile.html?id=${p.id}'">
            <div class="card-img">⭐</div>
            <div class="card-title">${p.name}</div>
            <div class="card-subtitle">⭐ ${p.rating}</div>
            <div class="card-action">${p.city}</div>
        </div>
    `).join('');
}

// Inject into checkAuth flow
const originalCheckAuth = window.checkAuth; // Assuming checkAuth is globally accessible or I need to find where to hook
// Since checkAuth is defined in the main file and not exposed as window.checkAuth maybe?
// Let's hook into window.checkAuth if it exists (it does in my previous read)

// We can just call it from DOMContentLoaded if we delay slightly or check auth again
// Or better: Append this function to the file content itself.

if (typeof window.checkAuth === 'function') {
    // It's async, but we can just run this in parallel after a short delay
    setTimeout(loadPersonalization, 2000);
}
