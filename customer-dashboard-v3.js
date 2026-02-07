// Khedmati - Customer Dashboard v3 (Stable)
const SUPABASE_URL = 'https://rkhkvmcnjuwoxammhsqn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJraGt2bWNuanV3b3hhbW1oc3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzODk0MjcsImV4cCI6MjA4NTk2NTQyN30.iGTVKa7iap8MLZ8v0efCvzsqzviNBbacVfEDxQGDsZQ';

// Global client variable
var supabaseClient;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    // Show loading status
    showStatus('جاري الاتصال بقاعدة البيانات...', 'warning');

    // Retry mechanism for Supabase library
    let attempts = 0;
    while (typeof window.supabase === 'undefined' && attempts < 50) {
        await new Promise(r => setTimeout(r, 100)); // Wait 100ms
        attempts++;
    }

    if (typeof window.supabase === 'undefined') {
        showStatus('خطأ: فشل تحميل المكتبة. تأكد من الاتصال.', 'error');
        return;
    }

    // Initialize Client
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    window.supabaseClient = supabaseClient;

    showStatus('تم الاتصال. جاري جلب البيانات...', 'info');

    // Start App
    checkAuth();
});

let currentUser = null;

// Helper: Show visual status
function showStatus(msg, type) {
    let el = document.getElementById('dashboardStatus');
    if (!el) {
        el = document.createElement('div');
        el.id = 'dashboardStatus';
        el.style.padding = '10px';
        el.style.textAlign = 'center';
        el.style.marginBottom = '15px';
        el.style.borderRadius = '8px';
        el.style.fontWeight = 'bold';

        const container = document.querySelector('.dashboard-container') || document.body;
        container.insertBefore(el, container.firstChild);
    }

    el.textContent = msg;
    el.style.display = 'block';

    if (type === 'error') {
        el.style.backgroundColor = '#fee2e2';
        el.style.color = '#ef4444';
    } else if (type === 'success') {
        el.style.backgroundColor = '#dcfce7';
        el.style.color = '#16a34a';
        setTimeout(() => { el.style.display = 'none'; }, 3000);
    } else {
        el.style.backgroundColor = '#e0f2fe';
        el.style.color = '#0284c7';
    }
}

// Check authentication
async function checkAuth() {
    if (!supabaseClient) return;

    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    currentUser = session.user;

    // Get user profile
    const { data: profile, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

    if (profile) {
        const displayName = profile.full_name || profile.email?.split('@')[0] || 'عميل';
        document.getElementById('userName').textContent = displayName;
        if (document.getElementById('welcomeName'))
            document.getElementById('welcomeName').textContent = displayName.split(' ')[0];
        if (document.getElementById('userAvatar'))
            document.getElementById('userAvatar').textContent = displayName.substring(0, 2);
    }

    // Load bookings immediately after auth
    loadBookings();
    loadReviews();
}

// Load bookings
async function loadBookings() {
    if (!currentUser || !supabaseClient) return;

    try {
        console.log('Loading bookings for user:', currentUser.id);

        // SIMPLE QUERY: No complex OR logic. Just matching ID.
        const { data: allBookings, error } = await supabaseClient
            .from('bookings')
            .select(`
                *,
                providers (
                    name,
                    specialty,
                    city,
                    phone
                )
            `)
            .eq('customer_id', currentUser.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Failed to load bookings:', error);
            showStatus('فشل تحميل الحجوزات: ' + error.message, 'error');
            return;
        }

        console.log('Loaded bookings:', allBookings);
        showStatus(`تم العثور على ${allBookings.length} حجز`, 'success');

        // Separate by status
        const pending = allBookings.filter(b => b.status === 'pending');
        const confirmed = allBookings.filter(b => b.status === 'confirmed');
        const completed = allBookings.filter(b => b.status === 'completed');

        // Update stats
        if (document.getElementById('totalBookings')) document.getElementById('totalBookings').textContent = allBookings.length;
        if (document.getElementById('pendingBookings')) document.getElementById('pendingBookings').textContent = pending.length;
        if (document.getElementById('confirmedBookings')) document.getElementById('confirmedBookings').textContent = confirmed.length;

        // Render bookings
        renderBookingsList('pendingBookingsList', pending, 'pending');
        renderBookingsList('confirmedBookingsList', confirmed, 'confirmed');
        renderBookingsList('completedBookingsList', completed, 'completed');

    } catch (err) {
        console.error('Critical Error:', err);
        showStatus('خطأ غير متوقع: ' + err.message, 'error');
    }
}

// Render bookings list
function renderBookingsList(elementId, bookings, type) {
    const list = document.getElementById(elementId);
    if (!list) return;

    if (bookings.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📅</div>
                <p>لا توجد حجوزات في هذه القائمة</p>
            </div>
        `;
        return;
    }

    list.innerHTML = bookings.map(booking => {
        const dateObj = new Date(booking.booking_date || booking.service_date);
        const dateStr = dateObj.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const providerName = booking.providers?.name || 'مقدم خدمة';
        const initial = providerName.charAt(0);
        const statusText = getStatusText(booking.status);
        const statusIcon = getStatusIcon(booking.status);

        return `
        <div class="booking-card status-${booking.status}">
            <div class="booking-content">
                <div class="booking-header">
                    <div class="booking-id">#${booking.id.slice(0, 8)}</div>
                    <div class="booking-status-badge">
                        <span>${statusIcon}</span>
                        <span>${statusText}</span>
                    </div>
                </div>

                <div class="counterparty-info">
                    <div class="avatar-circle">${initial}</div>
                    <div class="party-details">
                        <h4>${providerName}</h4>
                        <p>${booking.service_type || booking.providers?.specialty || 'خدمة عامة'}</p>
                    </div>
                </div>

                <div class="booking-grid">
                    <div class="info-group">
                        <span class="info-label">الموعد</span>
                        <div class="info-value">
                            <span class="icon">📅</span>
                            ${dateStr}
                        </div>
                    </div>
                    
                    <div class="info-group">
                        <span class="info-label">الوقت</span>
                        <div class="info-value">
                            <span class="icon">⏰</span>
                            ${booking.booking_time || booking.preferred_time}
                        </div>
                    </div>

                    ${booking.customer_location ? `
                    <div class="info-group">
                        <span class="info-label">الموقع</span>
                        <div class="info-value">
                            <span class="icon">📍</span>
                            ${booking.customer_location}
                        </div>
                    </div>` : ''}
                </div>

                ${booking.notes ? `
                <div class="info-group">
                    <span class="info-label">ملاحظات</span>
                    <div class="info-value" style="font-size: 0.9rem; color: #666;">
                        ${booking.notes}
                    </div>
                </div>` : ''}

                ${type === 'completed' && !booking.reviewed ? `
                <div class="booking-footer">
                    <button class="btn-action btn-primary-action" onclick="openReviewModal('${booking.id}', '${booking.provider_id}')">
                        <span>⭐</span> تقييم الخدمة
                    </button>
                </div>` : ''}
                
                ${type === 'completed' && booking.reviewed ? `
                <div class="booking-footer">
                    <div style="font-size: 0.9rem; color: #10b981;">✅ تم التقييم - شكراً لك!</div>
                </div>` : ''}
                
                ${type === 'pending' ? `
                <div class="booking-footer">
                   <div style="font-size: 0.85rem; color: #f59e0b;">⏳ بانتظار موافقة مقدم الخدمة</div>
                </div>` : ''}
            </div>
        </div>
    `}).join('');
}

function getStatusIcon(status) {
    switch (status) {
        case 'pending': return '⏳';
        case 'confirmed': return '✅';
        case 'completed': return '🎉';
        case 'cancelled': return '❌';
        default: return '🔹';
    }
}

function getStatusText(status) {
    const map = {
        'pending': 'بانتظار الرد',
        'confirmed': 'مؤكد',
        'completed': 'مكتمل',
        'cancelled': 'ملغي'
    };
    return map[status] || status;
}

// Load reviews
async function loadReviews() {
    if (!currentUser || !supabaseClient) return;

    const { data: profile } = await supabaseClient
        .from('profiles')
        .select('full_name')
        .eq('id', currentUser.id)
        .single();

    // Safety check just in case profile works differently
    const searchTerm = profile?.full_name || 'xxxx';

    const { data: reviews } = await supabaseClient
        .from('reviews')
        .select(`
            *,
            providers (name, specialty)
        `)
        .ilike('customer_name', `%${searchTerm}%`)
        .order('created_at', { ascending: false });

    if (document.getElementById('myReviews'))
        document.getElementById('myReviews').textContent = reviews?.length || 0;

    const list = document.getElementById('myReviewsList');
    if (!list) return;

    if (!reviews || reviews.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⭐</div>
                <p>لم تقم بتقييم أي خدمة بعد</p>
            </div>
        `;
        return;
    }

    list.innerHTML = reviews.map(review => `
        <div class="review-card">
            <div class="review-header">
                <div class="reviewer-name">${review.providers?.name}</div>
                <div class="review-date">${new Date(review.created_at).toLocaleDateString('ar-EG')}</div>
            </div>
            <div class="review-rating">
                ${'⭐'.repeat(review.rating)}
                <span style="color: #666; font-size: 0.9rem;">(${review.rating}/5)</span>
            </div>
            <p class="review-comment">${review.comment || 'لا يوجد تعليق'}</p>
        </div>
    `).join('');
}

// Tab switching
function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    // Access via event or fallback
    if (event && event.target) {
        event.target.classList.add('active');
    } else {
        // Fallback if called programmatically
        const btn = document.querySelector(`button[onclick="switchTab('${tabName}')"]`);
        if (btn) btn.classList.add('active');
    }

    const tab = document.getElementById(tabName + 'Tab');
    if (tab) tab.classList.add('active');
}

// Review Modal Globals
let selectedRating = 5;
const ratingLabels = {
    1: 'سيء جداً 😞',
    2: 'سيء',
    3: 'متوسط',
    4: 'جيد 👍',
    5: 'ممتاز 🌟'
};

// Global Functions
window.switchTab = switchTab;
window.openReviewModal = function (bookingId, providerId) {
    document.getElementById('reviewBookingId').value = bookingId;
    document.getElementById('reviewProviderId').value = providerId;
    document.getElementById('reviewModal').style.display = 'flex';
    setRating(5);
};
window.closeReviewModal = function () {
    document.getElementById('reviewModal').style.display = 'none';
    document.getElementById('reviewComment').value = '';
};
window.setRating = function (rating) {
    selectedRating = rating;
    document.getElementById('ratingValue').value = rating;
    const stars = document.querySelectorAll('#ratingStars span');
    stars.forEach((star, index) => {
        if (index < rating) {
            star.textContent = '⭐';
            star.style.opacity = '1';
        } else {
            star.textContent = '☆';
            star.style.opacity = '0.5';
        }
    });
    // Update label
    const labelEl = document.getElementById('ratingLabel');
    if (labelEl) labelEl.textContent = ratingLabels[rating] || '';
};
window.submitReview = async function (event) {
    event.preventDefault();
    const bookingId = document.getElementById('reviewBookingId').value;
    const providerId = document.getElementById('reviewProviderId').value;
    const rating = parseInt(document.getElementById('ratingValue').value);
    const comment = document.getElementById('reviewComment').value;

    try {
        // 1. Insert the review (with booking_id for tracking)
        const { error: reviewError } = await supabaseClient
            .from('reviews')
            .insert([{
                provider_id: providerId,
                booking_id: bookingId,
                customer_name: document.getElementById('userName').textContent,
                rating: rating,
                comment: comment
            }]);

        if (reviewError) throw reviewError;

        // 2. Mark booking as reviewed (prevent duplicate reviews)
        await supabaseClient
            .from('bookings')
            .update({ reviewed: true })
            .eq('id', bookingId);

        showStatus('تم إرسال التقييم بنجاح! شكراً لك ⭐', 'success');
        window.closeReviewModal();
        loadBookings(); // Reload to hide review button
        loadReviews();
    } catch (e) {
        showStatus('خطأ: ' + e.message, 'error');
    }
};
window.logout = async function () {
    if (supabaseClient) await supabaseClient.auth.signOut();
    window.location.href = 'index.html';
};
