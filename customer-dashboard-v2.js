// Khedmati - Customer Dashboard v2
const SUPABASE_URL = 'https://rkhkvmcnjuwoxammhsqn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJraGt2bWNuanV3b3hhbW1oc3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzODk0MjcsImV4cCI6MjA4NTk2NTQyN30.iGTVKa7iap8MLZ8v0efCvzsqzviNBbacVfEDxQGDsZQ';

// Global client variable
var supabaseClient;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    // Retry mechanism for Supabase library
    let attempts = 0;
    while (typeof window.supabase === 'undefined' && attempts < 50) {
        console.warn('Waiting for Supabase library...');
        await new Promise(r => setTimeout(r, 100)); // Wait 100ms
        attempts++;
    }

    if (typeof window.supabase === 'undefined') {
        alert('Critical Error: Failed to load Supabase library. Please refresh the page or check your connection.');
        return;
    }

    // Initialize Client
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    window.supabaseClient = supabaseClient;

    // Start App
    checkAuth();
    loadBookings();
    loadReviews();
});

let currentUser = null;
let currentBooking = null;

// Check authentication
async function checkAuth() {
    if (!supabaseClient) return; // Guard

    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    currentUser = session.user;

    // Get user profile
    const { data: profile } = await supabaseClient
        .from('profiles')
        .select('full_name, email')
        .eq('id', currentUser.id)
        .single();

    if (profile) {
        const displayName = profile.full_name || profile.email?.split('@')[0] || 'عميل';
        document.getElementById('userName').textContent = displayName;
        document.getElementById('welcomeName').textContent = displayName.split(' ')[0];
        document.getElementById('userAvatar').textContent = displayName.substring(0, 2);
    }
}

// Load bookings
async function loadBookings() {
    if (!currentUser || !supabaseClient) return;

    console.log('Loading bookings for user:', currentUser.id);

    // Get all bookings for this customer
    const { data: allBookings, error } = await supabaseClient
        .from('bookings')
        .select(`
            *,
            providers (
                id,
                name,
                specialty,
                city,
                phone,
                rating
            )
        `)
        .eq('customer_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Failed to load bookings:', error);
        return;
    }

    console.log('Loaded bookings:', allBookings);

    // Separate by status
    const pending = allBookings.filter(b => b.status === 'pending');
    const confirmed = allBookings.filter(b => b.status === 'confirmed');
    const completed = allBookings.filter(b => b.status === 'completed');

    // Update stats
    document.getElementById('totalBookings').textContent = allBookings.length;
    document.getElementById('pendingBookings').textContent = pending.length;
    document.getElementById('confirmedBookings').textContent = confirmed.length;

    // Render bookings
    renderBookingsList('pendingBookingsList', pending, 'pending');
    renderBookingsList('confirmedBookingsList', confirmed, 'confirmed');
    renderBookingsList('completedBookingsList', completed, 'completed');
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

    list.innerHTML = bookings.map(booking => `
        <div class="booking-card">
            <div class="booking-header">
                <div>
                    <div class="provider-name">${booking.providers?.name || 'مقدم خدمة'}</div>
                    <div class="service-type">${booking.service_type || booking.providers?.specialty || 'خدمة عامة'}</div>
                </div>
                <div class="booking-status status-${booking.status}">
                    ${getStatusText(booking.status)}
                </div>
            </div>
            
            <div class="booking-details">
                <div class="detail-item">
                    <span>📅 التاريخ:</span>
                    <span>${new Date(booking.booking_date).toLocaleDateString('ar-EG')}</span>
                </div>
                <div class="detail-item">
                    <span>⏰ الوقت:</span>
                    <span>${booking.booking_time}</span>
                </div>
                <div class="detail-item">
                    <span>📍 الموقع:</span>
                    <span>${booking.customer_location || 'غير محدد'}</span>
                </div>
                ${booking.notes ? `
                <div class="detail-item full-width">
                    <span>📝 ملاحطات:</span>
                    <span>${booking.notes}</span>
                </div>
                ` : ''}
            </div>

            ${type === 'completed' ? `
                <div class="booking-actions">
                    <button class="btn btn-primary btn-sm" onclick="openReviewModal('${booking.id}', '${booking.provider_id}')">
                        ⭐ تقييم الخدمة
                    </button>
                </div>
            ` : ''}
        </div>
    `).join('');
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

    const { data: reviews } = await supabaseClient
        .from('reviews')
        .select(`
            *,
            providers (name, specialty)
        `)
        .ilike('customer_name', `%${profile?.full_name}%`)
        .order('created_at', { ascending: false });

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

    event.target.classList.add('active');
    document.getElementById(tabName + 'Tab').classList.add('active');
}

// Review Modal
let selectedRating = 5;

function openReviewModal(bookingId, providerId) {
    document.getElementById('reviewBookingId').value = bookingId;
    document.getElementById('reviewProviderId').value = providerId;
    document.getElementById('reviewModal').style.display = 'flex';
    setRating(5); // Default to 5 stars
}

function closeReviewModal() {
    document.getElementById('reviewModal').style.display = 'none';
    document.getElementById('reviewComment').value = '';
}

function setRating(rating) {
    selectedRating = rating;
    document.getElementById('ratingValue').value = rating;

    // Update stars
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
}

// Submit Review
async function submitReview(event) {
    event.preventDefault();

    const bookingId = document.getElementById('reviewBookingId').value;
    const providerId = document.getElementById('reviewProviderId').value;
    const rating = parseInt(document.getElementById('ratingValue').value);
    const comment = document.getElementById('reviewComment').value;

    if (!supabaseClient) {
        alert('System error: connection not ready');
        return;
    }

    try {
        // Get current user's name
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('full_name')
            .eq('id', currentUser.id)
            .single();

        // Insert review
        const { error } = await supabaseClient
            .from('reviews')
            .insert([{
                provider_id: providerId,
                customer_name: profile?.full_name || 'عميل',
                rating: rating,
                comment: comment
            }]);

        if (error) throw error;

        // Update provider's rating and review count
        const { data: allReviews } = await supabaseClient
            .from('reviews')
            .select('rating')
            .eq('provider_id', providerId);

        const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;

        await supabaseClient
            .from('providers')
            .update({
                rating: avgRating.toFixed(1),
                review_count: allReviews.length
            })
            .eq('id', providerId);

        showNotification('تم إرسال تقييمك بنجاح! شكراً لك', 'success');
        closeReviewModal();
        await loadReviews();
    } catch (err) {
        console.error('Failed to submit review:', err);
        showNotification('خطأ في إرسال التقييم', 'error');
    }
}

// Logout
async function logout() {
    if (supabaseClient) {
        await supabaseClient.auth.signOut();
    }
    window.location.href = 'index.html';
}

// Notification function
function showNotification(message, type = 'info') {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const colors = { success: '#22c55e', error: '#ef4444', warning: '#f59e0b', info: '#0891b2' };

    notification.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
    notification.className = 'notification';

    Object.assign(notification.style, {
        position: 'fixed', bottom: '30px', left: '50%',
        transform: 'translateX(-50%) translateY(100px)',
        background: colors[type], color: 'white',
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

// Make functions globally accessible
window.switchTab = switchTab;
window.openReviewModal = openReviewModal;
window.closeReviewModal = closeReviewModal;
window.setRating = setRating;
window.submitReview = submitReview;
window.logout = logout;
