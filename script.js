// Khedmati - Jordan Local Services Platform
// Full Supabase Integration

// Supabase Configuration
const SUPABASE_URL = 'https://rkhkvmcnjuwoxammhsqn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJraGt2bWNuanV3b3hhbW1oc3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzODk0MjcsImV4cCI6MjA4NTk2NTQyN30.iGTVKa7iap8MLZ8v0efCvzsqzviNBbacVfEDxQGDsZQ';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Global state
let allProviders = [];
let allServices = [];
let notificationSubscription = null;

document.addEventListener('DOMContentLoaded', async function () {
    const perfStart = performance.now();
    console.log('🚀 [PERF] Page load started');
    
    // Register Service Worker for PWA (Only if on HTTP/HTTPS)
    if ('serviceWorker' in navigator && (window.location.protocol.indexOf('http') === 0)) {
        navigator.serviceWorker.register('sw.js')
            .then(() => console.log('✅ Service Worker registered'))
            .catch(err => console.log('SW registration failed:', err));
    } else {
        console.log('⚠️ Service Worker disabled (requires HTTPS or localhost)');
    }

    // Initialize the app - PARALLEL loading for speed
    const sessionPromise = checkSession();
    
    // Load critical above-the-fold content first (in parallel)
    console.log('📡 [PERF] Starting parallel data fetch...');
    const fetchStart = performance.now();
    
    const [services, providers] = await Promise.all([
        loadServicesData(),
        loadProvidersData()
    ]);
    
    console.log(`📡 [PERF] Data fetched in ${(performance.now() - fetchStart).toFixed(0)}ms (services: ${services?.length || 0}, providers: ${providers?.length || 0})`);
    
    // Render immediately
    const renderStart = performance.now();
    renderServices(services);
    renderProviders(providers);
    console.log(`🎨 [PERF] Rendered in ${(performance.now() - renderStart).toFixed(0)}ms`);
    
    // Non-critical content - load after main content
    await sessionPromise;
    console.log(`🔐 [PERF] Session checked in ${(performance.now() - perfStart).toFixed(0)}ms total`);
    
    // Load below-fold content with intersection observer (lazy)
    setupLazyLoading();
    
    setupEventListeners();
    setupAnimations();
    console.log(`✅ [PERF] Total load time: ${(performance.now() - perfStart).toFixed(0)}ms`);
    console.log('🛠️ خدمتي - تم تحميل الموقع بنجاح!');
});

// Check Session & Update UI
async function checkSession() {
    console.log('🔍 Checking session...');
    console.log('🔗 Connected to:', SUPABASE_URL);
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        console.log('📦 Session result:', session ? 'LOGGED IN' : 'NOT LOGGED IN');
        if (session) {
            console.log('👤 User:', session.user.email);
        }
        updateAuthUI(session);
        if (session) setupRealtimeNotifications(session);

        // Listen for auth changes
        supabaseClient.auth.onAuthStateChange((_event, session) => {
            console.log('🔄 Auth state changed:', _event, session ? 'LOGGED IN' : 'NOT LOGGED IN');
            updateAuthUI(session);
        });
    } catch (err) {
        console.error('❌ Session check failed:', err);
    }
}

async function updateAuthUI(session) {
    const guestButtons = document.querySelector('.guest-buttons');
    const userMenu = document.getElementById('userMenu');

    // Mobile menu elements
    const mobileLoginBtn = document.getElementById('mobileLoginBtn');
    const mobileSignupBtn = document.getElementById('mobileSignupBtn');
    const mobileCustomerDashboardBtn = document.getElementById('mobileCustomerDashboardBtn');
    const mobileProviderDashboardBtn = document.getElementById('mobileProviderDashboardBtn');
    const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');

    if (session) {
        guestButtons.classList.add('hidden');
        userMenu.classList.remove('hidden');

        // Update mobile menu for logged in users
        if (mobileLoginBtn) mobileLoginBtn.classList.add('hidden');
        if (mobileSignupBtn) mobileSignupBtn.classList.add('hidden');
        if (mobileLogoutBtn) mobileLogoutBtn.classList.remove('hidden');

        // 1. Immediate Display (from Google/Metadata)
        const metadata = session.user.user_metadata || {};
        const displayName = metadata.full_name || metadata.name || session.user.email.split('@')[0];
        const avatarUrl = metadata.avatar_url || metadata.picture;

        document.getElementById('userName').textContent = displayName;
        if (avatarUrl) {
            document.getElementById('userAvatar').innerHTML = `<img src="${avatarUrl}" alt="Avatar">`;
        }

        // 2. Background Fetch (Role Only)
        try {
            const { data: profile } = await supabaseClient
                .from('profiles')
                .select('role')
                .eq('id', session.user.id)
                .single();

            if (profile && profile.role === 'provider') {
                document.getElementById('dashboardBtn').classList.remove('hidden');
                if (mobileProviderDashboardBtn) mobileProviderDashboardBtn.classList.remove('hidden');
            } else if (profile && profile.role === 'customer') {
                document.getElementById('customerDashboardBtn').classList.remove('hidden');
                if (mobileCustomerDashboardBtn) mobileCustomerDashboardBtn.classList.remove('hidden');
            }
        } catch (e) {
            // Ignore low-priority error for profile fetch
            console.warn('Profile fetch warning:', e);
        }
    } else {
        guestButtons.classList.remove('hidden');
        userMenu.classList.add('hidden');

        // Show login buttons on mobile
        if (mobileLoginBtn) mobileLoginBtn.classList.remove('hidden');
        if (mobileSignupBtn) mobileSignupBtn.classList.remove('hidden');
        if (mobileLogoutBtn) mobileLogoutBtn.classList.add('hidden');
        if (mobileCustomerDashboardBtn) mobileCustomerDashboardBtn.classList.add('hidden');
        if (mobileProviderDashboardBtn) mobileProviderDashboardBtn.classList.add('hidden');
    }
}

async function handleLogout() {
    try {
        await supabaseClient.auth.signOut();
        window.location.reload();
    } catch (err) {
        console.error('Logout failed:', err);
    }
}

// Make logout global
window.handleLogout = handleLogout;

// Jordan Neighborhoods Data
const neighborhoodsByCity = {
    'عمان': ['عبدون', 'الصويفية', 'مرج الحمام', 'الهاشمي الشمالي', 'طبربور', 'الجبيهة', 'خلدا', 'الرابية', 'تلاع العلي', 'شفا بدران'],
    'اربد': ['حي الحسين', 'النزهة', 'الحي الشرقي', 'المدينة الصناعية', 'الرمثا', 'بيت راس'],
    'الزرقاء': ['الزرقاء الجديدة', 'المدينة الصناعية', 'الرصيفة', 'جبل طارق', 'الأمير محمد'],
    'العقبة': ['وسط المدينة', 'الشاطئ الجنوبي', 'السكة الحديد', 'العقبة الصناعية']
};

// Update neighborhoods dropdown based on selected city
function updateNeighborhoods() {
    const citySelect = document.getElementById('locationSelect');
    const neighborhoodWrapper = document.getElementById('neighborhoodWrapper');
    const neighborhoodSelect = document.getElementById('neighborhoodSelect');

    const selectedCity = citySelect.value;

    if (selectedCity && neighborhoodsByCity[selectedCity]) {
        // Show neighborhood dropdown
        neighborhoodWrapper.style.display = 'flex';

        // Populate neighborhoods
        const neighborhoods = neighborhoodsByCity[selectedCity];
        neighborhoodSelect.innerHTML = '<option value="">كل الأحياء</option>' +
            neighborhoods.map(n => `<option value="${n}">${n}</option>`).join('');
    } else {
        // Hide neighborhood dropdown if no city selected
        neighborhoodWrapper.style.display = 'none';
        neighborhoodSelect.innerHTML = '<option value="">كل الأحياء</option>';
    }
}

// Make updateNeighborhoods global
window.updateNeighborhoods = updateNeighborhoods;

// Utility to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Make escapeHtml global
window.escapeHtml = escapeHtml;

// ============ FAST DATA FETCHERS (separate from rendering) ============

// Fetch services data only (no DOM manipulation)
async function loadServicesData() {
    const start = performance.now();
    try {
        const { data: services, error } = await supabaseClient
            .from('service_stats')
            .select('*')
            .order('provider_count', { ascending: false });
        console.log(`   📦 services fetched in ${(performance.now() - start).toFixed(0)}ms`);
        if (error) throw error;
        allServices = services || [];
        return services || [];
    } catch (err) {
        console.error('Error fetching services:', err);
        return [];
    }
}

// Fetch providers data only (no DOM manipulation)
async function loadProvidersData(filter = {}) {
    const start = performance.now();
    try {
        let query = supabaseClient.from('providers').select('*');
        if (filter.city) query = query.eq('city', filter.city);
        if (filter.neighborhood) query = query.eq('neighborhood', filter.neighborhood);
        if (filter.search) query = query.or(`name.ilike.%${filter.search}%,specialty.ilike.%${filter.search}%`);
        
        const { data: providers, error } = await query
            .order('is_featured', { ascending: false })
            .order('rating', { ascending: false });
        console.log(`   📦 providers fetched in ${(performance.now() - start).toFixed(0)}ms`);
        if (error) throw error;
        allProviders = providers || [];
        return providers || [];
    } catch (err) {
        console.error('Error fetching providers:', err);
        return [];
    }
}

// Render services to DOM
function renderServices(services) {
    const grid = document.getElementById('servicesGrid');
    if (!grid) return;
    
    if (!services || services.length === 0) {
        grid.innerHTML = '<p class="error">لا توجد خدمات</p>';
        return;
    }
    
    grid.innerHTML = services.map(service => `
        <div class="service-card" data-service-id="${escapeHtml(service.id)}" onclick="filterByService('${escapeHtml(service.name_ar)}')">
            <div class="service-icon">${service.icon}</div>
            <h3>${escapeHtml(service.name_ar)}</h3>
            <p>${escapeHtml(service.description_ar || '')}</p>
            <span class="service-count">${service.provider_count || 0}+ مقدم خدمة</span>
        </div>
    `).join('');
}

// Render providers to DOM
function renderProviders(providers) {
    const grid = document.getElementById('providersGrid');
    if (!grid) return;
    
    if (!providers || providers.length === 0) {
        grid.innerHTML = '<p class="no-results">لا توجد نتائج. جرب بحث آخر.</p>';
        return;
    }
    
    grid.innerHTML = providers.map(provider => {
        const minPrice = provider.price_range_min != null ? provider.price_range_min : null;
        const maxPrice = provider.price_range_max != null ? provider.price_range_max : null;
        const avgPrice = (minPrice != null && maxPrice != null) ? ((minPrice + maxPrice) / 2) : (minPrice || maxPrice || null);
        
        return `
        <div class="provider-card" data-provider-id="${escapeHtml(provider.id)}" data-min-price="${minPrice || ''}" data-max-price="${maxPrice || ''}" data-avg-price="${avgPrice || ''}" onclick="window.location.href='provider-profile.html?id=${escapeHtml(provider.id)}'" style="cursor: pointer;">
            ${provider.is_featured ? '<div class="provider-badge">⭐ مميز</div>' : ''}
            ${provider.is_verified ? '<div class="verified-badge">✓ موثق</div>' : ''}
            <div class="provider-avatar">
                <div class="avatar-placeholder">${escapeHtml(provider.name).substring(0, 2)}</div>
            </div>
            <h3>${escapeHtml(provider.name)}</h3>
            <p class="provider-specialty">${escapeHtml(provider.specialty)}</p>
            <div class="provider-location">📍 ${escapeHtml(provider.city)}${provider.neighborhood ? ' - ' + escapeHtml(provider.neighborhood) : ''} - ${escapeHtml(provider.location)}</div>
            <div class="provider-rating">
                <span class="stars">${'⭐'.repeat(Math.round(provider.rating))}</span>
                <span>${provider.rating} (${provider.review_count} تقييم)</span>
            </div>
            <div class="provider-price-range" id="price-range-${provider.id}" style="margin-top:6px; padding:5px 12px; background:#f0fdfa; border:1px solid #ccfbf1; border-radius:8px; text-align:center; font-size:0.85rem; font-weight:600; color:#0d9488;">
                ${provider.price_range_min != null && provider.price_range_max != null
                    ? `💰 ${provider.price_range_min} - ${provider.price_range_max} د.أ`
                    : provider.price_range_min != null
                        ? `💰 يبدأ من ${provider.price_range_min} د.أ`
                        : `<span style="color:#9ca3af; font-weight:500;">💰 لا توجد أسعار محددة</span>`}
            </div>
            <div class="provider-offerings-preview" id="offerings-${provider.id}" style="display:none; margin-top:8px; display:flex; flex-wrap:wrap; gap:5px;"></div>
            <div class="provider-actions" style="display: flex; gap: 8px; margin-top: 10px;">
                <button class="btn btn-primary" style="flex: 1;" onclick="event.stopPropagation(); window.location.href='booking.html?provider_id=${escapeHtml(provider.id)}'">احجز الآن</button>
                ${provider.user_id ? `
                <button onclick="event.stopPropagation(); window.location.href='customer-dashboard.html?tab=messages&chat_with=${provider.user_id}&name=${encodeURIComponent(provider.name)}'" class="btn btn-outline" style="display: flex; align-items: center; justify-content: center; width: 40px; padding: 0; border: 1px solid var(--primary); color: var(--primary);" title="مراسلة">
                    💬
                </button>` : ''}
            </div>
        </div>
    `}).join('');
    
    // Load offerings preview for all providers (batch)
    loadOfferingsForCards(providers.map(p => p.id));
    
    // Re-apply animations
    applyScrollAnimations();
}

// ============ LAZY LOADING WITH INTERSECTION OBSERVER ============

// Data cache for prefetched content
const dataCache = {
    reviews: null,
    stats: null
};

// Setup lazy loading for below-fold content
function setupLazyLoading() {
    // Start prefetching in background (don't block)
    prefetchBelowFoldData();
    
    // Use Intersection Observer to render when visible
    const observerOptions = {
        root: null,
        rootMargin: '200px', // Start loading 200px before element comes into view
        threshold: 0
    };
    
    const lazyObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const target = entry.target;
                
                if (target.id === 'reviewsGrid' && !target.dataset.loaded) {
                    renderReviews(dataCache.reviews);
                    target.dataset.loaded = 'true';
                    lazyObserver.unobserve(target);
                }
            }
        });
    }, observerOptions);
    
    // Observe sections that should lazy load
    const reviewsGrid = document.getElementById('reviewsGrid');
    if (reviewsGrid) lazyObserver.observe(reviewsGrid);
    
    // Stats will be rendered by prefetchBelowFoldData when ready
}

// Prefetch data that will be needed soon
async function prefetchBelowFoldData() {
    // Fetch reviews and stats in parallel
    const [reviews, stats] = await Promise.all([
        fetchReviewsData(),
        fetchStatsData()
    ]);
    
    dataCache.reviews = reviews;
    dataCache.stats = stats;
    
    // Render stats immediately since they're above fold
    animateNumber(document.getElementById('providerCount'), stats.providerCount, '+');
    animateNumber(document.getElementById('bookingCount'), stats.bookingCount, '+');
}

// Fetch reviews data only
async function fetchReviewsData() {
    try {
        const { data: reviews, error } = await supabaseClient
            .from('reviews')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(6);
        if (error) throw error;
        return reviews || [];
    } catch (err) {
        console.error('Error fetching reviews:', err);
        return [];
    }
}

// Fetch stats data only
async function fetchStatsData() {
    try {
        const [providerResult, bookingResult] = await Promise.all([
            supabaseClient.from('providers').select('*', { count: 'exact', head: true }),
            supabaseClient.from('bookings').select('*', { count: 'exact', head: true })
        ]);
        return {
            providerCount: providerResult.count || 8,
            bookingCount: (bookingResult.count || 0) + 50
        };
    } catch (err) {
        console.error('Error fetching stats:', err);
        return { providerCount: 8, bookingCount: 50 };
    }
}

// Render reviews to DOM
function renderReviews(reviews) {
    const grid = document.getElementById('reviewsGrid');
    if (!grid) return;
    
    if (!reviews || reviews.length === 0) {
        grid.innerHTML = '<p>لا توجد آراء بعد</p>';
        return;
    }
    
    grid.innerHTML = reviews.map(review => `
        <div class="testimonial-card">
            <div class="quote-icon">"</div>
            <p class="testimonial-text">${escapeHtml(review.comment)}</p>
            <div class="testimonial-author">
                <div class="author-avatar">${escapeHtml(review.customer_name).substring(0, 2)}</div>
                <div class="author-info">
                    <span class="author-name">${escapeHtml(review.customer_name)}</span>
                    <span class="author-rating">${'⭐'.repeat(review.rating)}</span>
                </div>
            </div>
        </div>
    `).join('');
}

// Render stats to DOM
function renderStats() {
    // Use cached data if available, otherwise fetch fresh
    if (dataCache.stats) {
        animateNumber(document.getElementById('providerCount'), dataCache.stats.providerCount, '+');
        animateNumber(document.getElementById('bookingCount'), dataCache.stats.bookingCount, '+');
    } else {
        // Fallback: fetch and render
        fetchStatsData().then(stats => {
            dataCache.stats = stats;
            animateNumber(document.getElementById('providerCount'), stats.providerCount, '+');
            animateNumber(document.getElementById('bookingCount'), stats.bookingCount, '+');
        });
    }
}

// Load services from database (legacy - kept for compatibility)
async function loadServices() {
    const grid = document.getElementById('servicesGrid');
    try {
        // Use service_stats view which has dynamic provider_count
        const { data: services, error } = await supabaseClient
            .from('service_stats')
            .select('*')
            .order('provider_count', { ascending: false });

        if (error) throw error;
        allServices = services || [];

        grid.innerHTML = services.map(service => `
            <div class="service-card" data-service-id="${escapeHtml(service.id)}" onclick="filterByService('${escapeHtml(service.name_ar)}')">
                <div class="service-icon">${service.icon}</div>
                <h3>${escapeHtml(service.name_ar)}</h3>
                <p>${escapeHtml(service.description_ar || '')}</p>
                <span class="service-count">${service.provider_count || 0}+ مقدم خدمة</span>
            </div>
        `).join('');
    } catch (err) {
        console.error('Error loading services:', err);
        grid.innerHTML = '<p class="error">خطأ في تحميل الخدمات</p>';
    }
}

// Load providers from database (used for searches/filters)
async function loadProviders(filter = {}) {
    const grid = document.getElementById('providersGrid');
    // Show skeleton loading instead of spinner
    grid.innerHTML = `
        <div class="skeleton-card">
            <div class="skeleton skeleton-avatar"></div>
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text" style="width: 60%;"></div>
            <div class="skeleton skeleton-btn"></div>
        </div>
        <div class="skeleton-card">
            <div class="skeleton skeleton-avatar"></div>
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text" style="width: 60%;"></div>
            <div class="skeleton skeleton-btn"></div>
        </div>
        <div class="skeleton-card">
            <div class="skeleton skeleton-avatar"></div>
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text" style="width: 60%;"></div>
            <div class="skeleton skeleton-btn"></div>
        </div>
    `;

    try {
        const providers = await loadProvidersData(filter);
        renderProviders(providers);
    } catch (err) {
        console.error('Error loading providers:', err);
        grid.innerHTML = '<p class="error">خطأ في تحميل مقدمي الخدمات</p>';
    }
}

// Load service offerings preview pills for provider cards on homepage
async function loadOfferingsForCards(providerIds) {
    if (!providerIds || providerIds.length === 0) return;
    try {
        const { data, error } = await supabaseClient
            .from('service_offerings')
            .select('id, provider_id, title, price, price_type, image_url')
            .in('provider_id', providerIds)
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        if (error) {
            console.warn('⚠️ service_offerings query failed (table may not exist):', error.message);
            return; // Silently fail - offerings are optional
        }

        const offerings = data || [];

        // Group by provider
        const grouped = {};
        offerings.forEach(o => {
            if (!grouped[o.provider_id]) grouped[o.provider_id] = [];
            grouped[o.provider_id].push(o);
        });

        // For ALL providers (including ones with no offerings), update price display
        providerIds.forEach(provId => {
            const priceRangeEl = document.getElementById('price-range-' + provId);
            const container = document.getElementById('offerings-' + provId);
            const provOfferings = grouped[provId] || [];

            // Only override price if provider didn't manually set a range
            const card = document.querySelector(`[data-provider-id="${provId}"]`);
            const hasManualRange = card && card.querySelector('.provider-price-range') && 
                !card.querySelector('.provider-price-range').innerHTML.includes('لا توجد أسعار محددة');

            // Compute average price from offerings (for sorting/filtering)
            const prices = provOfferings.map(o => parseFloat(o.price)).filter(p => !isNaN(p) && p > 0);
            if (card && prices.length > 0) {
                const minPrice = Math.min(...prices);
                const maxPrice = Math.max(...prices);
                const avgPrice = (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(1);
                card.dataset.minPrice = minPrice;
                card.dataset.maxPrice = maxPrice;
                card.dataset.avgPrice = avgPrice;
            }

            // If no manual range set and we have offering prices, show computed average
            if (priceRangeEl && !hasManualRange && prices.length > 0) {
                const avgPrice = (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(1);
                priceRangeEl.innerHTML = `💰 متوسط السعر: <strong>${avgPrice}</strong> د.أ`;
            }

            // Render top 3 offerings as pills
            if (!container || provOfferings.length === 0) return;

            const top3 = provOfferings.slice(0, 3);
            container.style.display = 'flex';
            container.innerHTML = top3.map(o => `
                <div style="display:inline-flex; align-items:center; gap:4px; background:#f0fdfa; border:1px solid #ccfbf1; border-radius:20px; padding:3px 10px 3px 6px; font-size:0.75rem; white-space:nowrap;">
                    ${o.image_url ? `<img src="${o.image_url}" style="width:18px; height:18px; border-radius:50%; object-fit:cover;">` : `<span style="font-size:0.7rem;">🔧</span>`}
                    <span style="color:#374151; font-weight:500;">${escapeHtml(o.title)}</span>
                    <span style="color:#0891b2; font-weight:700;">${o.price}د.أ</span>
                </div>
            `).join('');
        });
    } catch (err) {
        console.error('Error loading offerings for cards:', err);
    }
}

// ============ SORTING & FILTERING ============

let currentSort = 'rating';

function sortProviders(sortBy) {
    currentSort = sortBy;
    // Update active button (only sort buttons, not the apply button)
    document.querySelectorAll('#sortRating, #sortPriceLow, #sortPriceHigh').forEach(btn => btn.classList.remove('active'));
    const btnId = sortBy === 'rating' ? 'sortRating' : sortBy === 'price_low' ? 'sortPriceLow' : 'sortPriceHigh';
    const btn = document.getElementById(btnId);
    if (btn) btn.classList.add('active');

    const grid = document.getElementById('providersGrid');
    if (!grid) return;
    const cards = Array.from(grid.querySelectorAll('.provider-card'));
    if (cards.length === 0) return;

    cards.sort((a, b) => {
        if (sortBy === 'rating') {
            // Find rating from the allProviders array
            const provA = allProviders.find(p => p.id === a.dataset.providerId);
            const provB = allProviders.find(p => p.id === b.dataset.providerId);
            const ratingA = provA ? provA.rating : 0;
            const ratingB = provB ? provB.rating : 0;
            return ratingB - ratingA;
        } else if (sortBy === 'price_low') {
            const pA = parseFloat(a.dataset.minPrice) || 9999;
            const pB = parseFloat(b.dataset.minPrice) || 9999;
            return pA - pB;
        } else if (sortBy === 'price_high') {
            const pA = parseFloat(a.dataset.maxPrice) || 0;
            const pB = parseFloat(b.dataset.maxPrice) || 0;
            return pB - pA;
        }
        return 0;
    });

    // Re-append in sorted order
    cards.forEach(card => grid.appendChild(card));
}

// Update the visual price bar between min and max
function updatePriceBar() {
    const minInput = document.getElementById('minPriceInput');
    const maxInput = document.getElementById('maxPriceInput');
    const fill = document.getElementById('priceBarFill');
    
    if (!minInput || !maxInput || !fill) return;
    
    let minVal = parseInt(minInput.value) || 0;
    let maxVal = parseInt(maxInput.value) || 500;
    
    // Clamp values
    minVal = Math.max(0, Math.min(500, minVal));
    maxVal = Math.max(0, Math.min(500, maxVal));
    
    // Don't swap - just clamp max to be at least min
    if (maxVal < minVal) {
        maxVal = minVal;
        maxInput.value = maxVal;
    }
    
    const minPercent = (minVal / 500) * 100;
    const maxPercent = (maxVal / 500) * 100;
    
    // Bar fills from right (min) to left (max) for RTL layout
    fill.style.right = minPercent + '%';
    fill.style.width = (maxPercent - minPercent) + '%';
}

function applyPriceFilter() {
    const minPrice = parseFloat(document.getElementById('minPriceInput').value) || 0;
    const maxPrice = parseFloat(document.getElementById('maxPriceInput').value) || 500;
    const grid = document.getElementById('providersGrid');
    if (!grid) return;
    const cards = grid.querySelectorAll('.provider-card');

    let hiddenCount = 0;
    cards.forEach(card => {
        const avgP = parseFloat(card.dataset.avgPrice);
        // Hide if price is outside the range (or show all if no price data)
        if (!isNaN(avgP) && (avgP < minPrice || avgP > maxPrice)) {
            card.style.display = 'none';
            hiddenCount++;
        } else {
            card.style.display = '';
        }
    });
    // Re-apply current sort after filtering
    if (currentSort) sortProviders(currentSort);
}

// Initialize price bar on page load
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(updatePriceBar, 100);
});

// Load reviews from database
async function loadReviews() {
    const grid = document.getElementById('reviewsGrid');
    try {
        const { data: reviews, error } = await supabaseClient
            .from('reviews')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(6);

        if (error) throw error;

        if (!reviews || reviews.length === 0) {
            grid.innerHTML = '<p>لا توجد آراء بعد</p>';
            return;
        }

        grid.innerHTML = reviews.map(review => `
            <div class="testimonial-card">
                <div class="quote-icon">"</div>
                <p class="testimonial-text">${escapeHtml(review.comment)}</p>
                <div class="testimonial-author">
                    <div class="author-avatar">${escapeHtml(review.customer_name).substring(0, 2)}</div>
                    <div class="author-info">
                        <span class="author-name">${escapeHtml(review.customer_name)}</span>
                        <span class="author-rating">${'⭐'.repeat(review.rating)}</span>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('Error loading reviews:', err);
    }
}

// Load statistics
async function loadStats() {
    try {
        // Get provider count
        const { count: providerCount } = await supabaseClient
            .from('providers')
            .select('*', { count: 'exact', head: true });

        // Get booking count
        const { count: bookingCount } = await supabaseClient
            .from('bookings')
            .select('*', { count: 'exact', head: true });

        animateNumber(document.getElementById('providerCount'), providerCount || 8, '+');
        animateNumber(document.getElementById('bookingCount'), (bookingCount || 0) + 50, '+');
    } catch (err) {
        console.error('Error loading stats:', err);
    }
}

// Animate number counter
function animateNumber(element, target, suffix = '') {
    if (!element) return;
    let current = 0;
    const increment = target / 40;
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            current = target;
            clearInterval(timer);
        }
        element.textContent = Math.floor(current).toLocaleString() + suffix;
    }, 30);
}

// Search functionality
function setupEventListeners() {
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');
    const locationSelect = document.getElementById('locationSelect');

    if (searchBtn) {
        searchBtn.addEventListener('click', performSearch);
    }
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') performSearch();
        });
    }

    // Booking form
    const bookingForm = document.getElementById('bookingForm');
    if (bookingForm) {
        bookingForm.addEventListener('submit', handleBooking);
    }

    // Mobile menu
    setupMobileMenu();

    // Smooth scroll
    setupSmoothScroll();

    // Set minimum date for booking to today
    const dateInput = document.getElementById('serviceDate');
    if (dateInput) {
        dateInput.min = new Date().toISOString().split('T')[0];
    }
}

async function performSearch(queryOverride = null) {
    const searchInput = document.getElementById('searchInput');
    const locationSelect = document.getElementById('locationSelect');
    const neighborhoodSelect = document.getElementById('neighborhoodSelect');

    // Use override if provided, otherwise check input if it exists, otherwise empty
    let search = queryOverride;
    if (search === null) {
        search = searchInput ? searchInput.value.trim() : '';
    }

    const city = locationSelect ? locationSelect.value : '';
    const neighborhood = neighborhoodSelect ? neighborhoodSelect.value : '';

    showNotification('جاري البحث...', 'info');

    await loadProviders({ search, city, neighborhood });

    // Scroll to providers section
    const providersSection = document.getElementById('providers');
    if (providersSection) {
        providersSection.scrollIntoView({ behavior: 'smooth' });
    }

    const count = allProviders.length;
    showNotification(`تم العثور على ${count} نتيجة! 🎉`, 'success');
}

function filterByService(serviceName) {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = serviceName;
    }
    performSearch(serviceName);
}

// AI Matchmaking Logic
const keywordMap = {
    'سباكة': ['ماء', 'تسرب', 'حنفية', 'مغسلة', 'ماسورة', 'سباك', 'تنفيس', 'بالوعة', 'مجاري', 'مواسير', 'ليك', 'خراب', 'plumbing', 'leak', 'water', 'pipe', 'sink', 'faucet'],
    'كهرباء': ['ضوء', 'لمبة', 'فيش', 'شورت', 'كهرباء', 'قاطع', 'أسلاك', 'بريز', 'انقطاع', 'فيوز', 'electricity', 'light', 'lamp', 'power', 'socket', 'fuse'],
    'نجارة': ['باب', 'شباك', 'خشب', 'خزانة', 'تركيب', 'مفصلات', 'قفل', 'يد', 'طاولة', 'كرسي', 'أثاث', 'carpentry', 'wood', 'door', 'window', 'lock', 'furniture'],
    'تنظيف': ['تنظيف', 'غسيل', 'سجاد', 'كنب', 'ستائر', 'جلي', 'شطف', 'تعقيم', 'موكيت', 'وسخ', 'فوضى', 'كركبة', 'house is messy', 'messy', 'clean', 'dirty', 'dust', 'cleaning'],
    'تكييف': ['مكيف', 'حامي', 'بارد', 'صيانة', 'فلاتر', 'تعبئة غاز', 'تنقيط', 'تبريد', 'تدفئة', 'ac', 'air condition', 'hvac', 'cooling', 'heating', 'hot', 'cold'],
    'دهان': ['دهان', 'بوية', 'تقشير', 'رطوبة', 'لون', 'طلاء', 'معجون', 'painting', 'paint', 'wall', 'color'],
    'ستلايت': ['ستلايت', 'رسيفر', 'اشارة', 'قنوات', 'دش', 'صحن', 'نايل سات', 'عرب سات', 'satellite', 'receiver', 'dish', 'signal', 'channels'],
    'نقل عفش': ['نقل', 'ترحيل', 'عفش', 'اثاث', 'فك وتركيب', 'ونش', 'ديانا', 'moving', 'relocation', 'furniture moving'],
    // New services
    'ألمنيوم': ['المنيوم', 'شباك', 'نافذة', 'باب المنيوم', 'زجاج', 'aluminum', 'window', 'glass'],
    'حدادة': ['حديد', 'حدادة', 'باب حديد', 'شبك', 'درابزين', 'سور', 'iron', 'metal', 'gate'],
    'بلاط وسيراميك': ['بلاط', 'سيراميك', 'رخام', 'كسر', 'tiles', 'ceramic', 'marble', 'flooring'],
    'جبس وديكور': ['جبس', 'ديكور', 'اسقف', 'جبسنبورد', 'زخرفة', 'gypsum', 'decoration', 'ceiling'],
    'عزل مائي': ['عزل', 'تسريب', 'سطح', 'خزان', 'رطوبة', 'waterproof', 'insulation', 'leak'],
    'مكافحة حشرات': ['حشرات', 'صراصير', 'نمل', 'فئران', 'بق', 'رش', 'pest', 'insects', 'bugs', 'rats'],
    'صيانة غسالات': ['غسالة', 'لا تعصر', 'لا تشتغل', 'washing machine', 'washer'],
    'صيانة ثلاجات': ['ثلاجة', 'فريزر', 'لا تبرد', 'refrigerator', 'fridge', 'freezer'],
    'صيانة أفران': ['فرن', 'طباخ', 'غاز', 'لهب', 'oven', 'stove', 'cooker'],
    'صيانة سخانات': ['سخان', 'بويلر', 'ماء ساخن', 'heater', 'boiler', 'hot water'],
    'كاميرات مراقبة': ['كاميرا', 'مراقبة', 'تسجيل', 'أمان', 'cctv', 'camera', 'security', 'surveillance'],
    'شبكات وانترنت': ['انترنت', 'راوتر', 'واي فاي', 'شبكة', 'wifi', 'router', 'network', 'internet'],
    'صيانة كمبيوتر': ['كمبيوتر', 'لابتوب', 'بطيء', 'فيروس', 'شاشة', 'computer', 'laptop', 'slow', 'virus'],
    'صيانة جوالات': ['جوال', 'موبايل', 'شاشة مكسورة', 'بطارية', 'phone', 'mobile', 'screen', 'battery'],
    'ميكانيك سيارات': ['سيارة', 'موتور', 'ماكينة', 'زيت', 'فرامل', 'car', 'engine', 'brakes', 'mechanic'],
    'كهرباء سيارات': ['بطارية سيارة', 'دينمو', 'سلف', 'كهرباء سيارة', 'car battery', 'alternator'],
    'تلميع سيارات': ['تلميع', 'غسيل سيارة', 'بوليش', 'شمع', 'car wash', 'polish', 'detailing'],
    'بنشر متنقل': ['بنشر', 'عجل', 'تاير', 'كفر', 'puncture', 'tire', 'flat'],
    'حلاقة منزلية': ['حلاقة', 'شعر', 'قص', 'حلاق', 'haircut', 'barber', 'hair'],
    'تجميل منزلي': ['تجميل', 'مكياج', 'أظافر', 'عروس', 'makeup', 'beauty', 'nails', 'bride'],
    'تمريض منزلي': ['ممرض', 'حقن', 'مريض', 'رعاية صحية', 'nurse', 'injection', 'medical'],
    'علاج طبيعي': ['علاج طبيعي', 'فيزيوثيرابي', 'تأهيل', 'عضلات', 'physiotherapy', 'therapy', 'rehab'],
    'رعاية مسنين': ['مسن', 'كبير سن', 'رعاية', 'elderly', 'senior', 'care'],
    'رعاية أطفال': ['أطفال', 'مربية', 'حضانة', 'babysitter', 'nanny', 'childcare'],
    'دروس خصوصية': ['دروس', 'تعليم', 'معلم', 'مدرس', 'رياضيات', 'انجليزي', 'tutor', 'teacher', 'lessons', 'math', 'english'],
    'تدريب رياضي': ['رياضة', 'جم', 'لياقة', 'تمارين', 'مدرب', 'fitness', 'trainer', 'gym', 'workout'],
    'تعليم قيادة': ['سواقة', 'رخصة', 'قيادة', 'driving', 'license', 'instructor'],
    'تعليم سباحة': ['سباحة', 'مسبح', 'swim', 'pool', 'swimming'],
    'توصيل طلبات': ['توصيل', 'ديليفري', 'طلبات', 'delivery', 'courier'],
    'خياطة': ['خياطة', 'تفصيل', 'تعديل', 'ملابس', 'tailor', 'sewing', 'alterations'],
    'زراعة وحدائق': ['حديقة', 'زراعة', 'نباتات', 'أشجار', 'عشب', 'garden', 'plants', 'landscaping'],
    'تصوير': ['تصوير', 'مصور', 'فوتوغرافي', 'صور', 'photography', 'photographer', 'photos'],
    'طبخ منزلي': ['طبخ', 'طباخ', 'أكل', 'وجبات', 'cooking', 'chef', 'food', 'meals'],
    'طاقة شمسية': ['طاقة شمسية', 'ألواح', 'سولار', 'solar', 'panels', 'energy']
};

function openAIModal() {
    const modal = document.getElementById('aiModal');
    modal.style.display = 'flex';
    // Force visibility to override CSS class
    setTimeout(() => {
        modal.style.opacity = '1';
        modal.style.visibility = 'visible';
    }, 10);
    document.body.style.overflow = 'hidden';
}

function closeAIModal() {
    const modal = document.getElementById('aiModal');
    modal.style.opacity = '0';
    modal.style.visibility = 'hidden';

    setTimeout(() => {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }, 300); // Wait for transition
}

function analyzeProblem() {
    const userInput = document.getElementById('aiProblemInput').value.toLowerCase();

    if (userInput.length < 3) {
        showNotification('الرجاء وصف المشكلة بشكل أوضح', 'error');
        return;
    }

    let bestMatch = null;
    let maxMatches = 0;

    // Check keywords
    for (const [category, keywords] of Object.entries(keywordMap)) {
        let matches = 0;
        keywords.forEach(keyword => {
            if (userInput.includes(keyword)) matches++;
        });

        if (matches > maxMatches) {
            maxMatches = matches;
            bestMatch = category;
        }
    }

    closeAIModal();

    if (bestMatch) {
        showNotification(`💡 يبدو أنك تبحث عن خدمات ${bestMatch}!`, 'success');
        document.getElementById('searchInput').value = bestMatch;
        performSearch();
    } else {
        showNotification('🤔 لم أستطع تحديد الخدمة بدقة، جاري البحث عن النص...', 'info');
        document.getElementById('searchInput').value = userInput;
        performSearch();
    }
}

// Make functions global
window.openAIModal = openAIModal;
window.closeAIModal = closeAIModal;
window.analyzeProblem = analyzeProblem;

// Booking Modal
function openBookingModal(providerId, providerName) {
    window.location.href = `booking.html?provider_id=${providerId}`;
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    document.body.style.overflow = '';
}

// Handle booking submission
async function handleBooking(e) {
    e.preventDefault();

    const providerId = document.getElementById('bookingProviderId').value;
    const customerName = document.getElementById('customerName').value;
    const customerPhone = document.getElementById('customerPhone').value;
    const serviceDate = document.getElementById('serviceDate').value;
    const preferredTime = document.getElementById('preferredTime').value;
    const notes = document.getElementById('bookingNotes').value;

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'جاري الإرسال...';

    try {
        // Check if user is logged in
        const { data: { user } } = await supabaseClient.auth.getUser();
        const customerId = user ? user.id : null;

        const { data, error } = await supabaseClient
            .from('bookings')
            .insert([{
                provider_id: providerId,
                customer_id: customerId, // Link to user account if logged in
                customer_name: customerName,
                customer_phone: customerPhone,
                service_date: serviceDate,
                preferred_time: preferredTime,
                notes: notes,
                status: 'pending'
            }])
            .select();

        if (error) throw error;

        closeModal('bookingModal');
        showNotification('تم الحجز بنجاح! سيتواصل معك مقدم الخدمة قريباً 🎉', 'success');

        // Reset form
        e.target.reset();

        // Reload stats
        loadStats();
    } catch (err) {
        console.error('Booking error:', err);
        showNotification('حدث خطأ. حاول مرة أخرى.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'تأكيد الحجز';
    }
}

// Provider signup - redirect to login page
function showProviderSignup() {
    window.location.href = 'login.html';
}

// Notification system
function showNotification(message, type = 'info') {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;

    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const colors = { success: '#22c55e', error: '#ef4444', warning: '#f59e0b', info: '#0891b2' };

    notification.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;

    Object.assign(notification.style, {
        position: 'fixed', bottom: '30px', left: '50%',
        transform: 'translateX(-50%) translateY(100px)',
        background: colors[type] || colors.info, color: 'white',
        padding: '16px 28px', borderRadius: '12px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
        display: 'flex', alignItems: 'center', gap: '12px',
        fontSize: '1rem', fontWeight: '600', zIndex: '9999',
        transition: 'transform 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        fontFamily: 'Tajawal, sans-serif'
    });

    document.body.appendChild(notification);
    requestAnimationFrame(() => {
        notification.style.transform = 'translateX(-50%) translateY(0)';
    });
    setTimeout(() => {
        notification.style.transform = 'translateX(-50%) translateY(100px)';
        setTimeout(() => notification.remove(), 400);
    }, 3000);
}

// Mobile Menu
function setupMobileMenu() {
    const btn = document.querySelector('.mobile-menu-btn');
    const overlay = document.querySelector('.mobile-menu-overlay');
    const close = document.querySelector('.mobile-menu-close');
    const links = document.querySelectorAll('.mobile-menu-links a');

    const openMenu = () => { overlay.classList.add('active'); document.body.style.overflow = 'hidden'; };
    const closeMenu = () => { overlay.classList.remove('active'); document.body.style.overflow = ''; };

    btn?.addEventListener('click', openMenu);
    close?.addEventListener('click', closeMenu);
    overlay?.addEventListener('click', (e) => { if (e.target === overlay) closeMenu(); });
    links.forEach(link => link.addEventListener('click', closeMenu));
}

// Smooth scroll
function setupSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const navHeight = document.querySelector('.navbar').offsetHeight;
                window.scrollTo({ top: target.offsetTop - navHeight - 20, behavior: 'smooth' });
            }
        });
    });
}

// Animations
function setupAnimations() {
    // Navbar scroll effect
    window.addEventListener('scroll', () => {
        const navbar = document.querySelector('.navbar');
        if (window.pageYOffset > 100) {
            navbar.style.background = 'rgba(255, 255, 255, 0.98)';
            navbar.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.1)';
        } else {
            navbar.style.background = 'rgba(255, 255, 255, 0.95)';
            navbar.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
        }
    });

    applyScrollAnimations();
}

function applyScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.service-card, .step, .provider-card, .testimonial-card').forEach((el, i) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = `opacity 0.6s ease ${i * 0.05}s, transform 0.6s ease ${i * 0.05}s`;
        observer.observe(el);
    });
}

// Close modal on escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(modal => {
            modal.classList.remove('active');
        });
        document.body.style.overflow = '';
    }
});

// Provider Signup Logic
async function showProviderSignup() {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (session) {
        // Check current role
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();

        if (profile?.role === 'provider') {
            window.location.href = 'dashboard.html';
        } else {
            // Logged in as customer -> redirect to upgrade flow
            window.location.href = 'become-provider.html';
        }
    } else {
        // Not logged in -> Go to signup with provider flag
        window.location.href = 'signup.html?type=provider';
    }
}

// Real-time Notifications
async function setupRealtimeNotifications(session) {
    if (!session || notificationSubscription) return;

    const userId = session.user.id;
    console.log('🔔 Setting up notifications for:', userId);

    try {
        notificationSubscription = supabaseClient
            .channel('public:notifications')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${userId}`
            }, payload => {
                console.log('📩 New notification:', payload.new);
                handleNewNotification(payload.new);
            })
            .subscribe((status) => {
                console.log('🔔 Notification subscription status:', status);
            });
    } catch (err) {
        console.error('Error setting up notifications:', err);
    }
}

function handleNewNotification(notification) {
    // Show toast with sound effect hint (visual only for now)
    const type = notification.type === 'alert' ? 'error' : 'info';
    showNotification(`🔔 ${notification.title}: ${notification.message}`, type);
}

// ===== Dark Mode =====
function toggleDarkMode() {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    if (isDark) {
        html.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
    } else {
        html.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    }
    updateThemeIcons();
}

function updateThemeIcons() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.querySelectorAll('.theme-toggle').forEach(btn => {
        btn.textContent = isDark ? '☀️' : '🌙';
    });
}

// Apply saved theme icons on DOM ready
document.addEventListener('DOMContentLoaded', updateThemeIcons);
