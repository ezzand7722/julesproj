// Khedmati - Customer Dashboard
const SUPABASE_URL = 'https://rkhkvmcnjuwoxammhsqn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJraGt2bWNuanV3b3hhbW1oc3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzODk0MjcsImV4cCI6MjA4NTk2NTQyN30.iGTVKa7iap8MLZ8v0efCvzsqzviNBbacVfEDxQGDsZQ';

// Ensure Supabase is loaded
if (typeof window.supabase === 'undefined') {
    console.error('CRITICAL: Supabase library not loaded! Checking fallback...');
}

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabaseClient = supabaseClient; // Expose globally like dashboard.js

let currentUser = null;
let currentBooking = null;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await loadBookings();
    await loadReviews();

    // Initialize Chat
    if (window.initChat) {
        await window.initChat();
    }
});

// Check authentication
async function checkAuth() {
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
    if (!currentUser) return;

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
function renderBookingsList(containerId, bookings, type) {
    const container = document.getElementById(containerId);

    if (!bookings || bookings.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <p>لا توجد حجوزات ${type === 'pending' ? 'بانتظار الرد' : type === 'confirmed' ? 'مؤكدة' : 'مكتملة'}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = bookings.map(booking => {
        const provider = booking.providers;
        const date = new Date(booking.service_date).toLocaleDateString('ar-JO', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const statusLabel = {
            'pending': 'بانتظار التأكيد',
            'confirmed': 'مؤكد',
            'completed': 'مكتمل',
            'cancelled': 'ملغي'
        }[booking.status];

        return `
            <div class="booking-item">
                <div class="booking-header">
                    <div class="provider-info">
                        <h3>${provider?.name || 'مقدم خدمة'}</h3>
                        <p>⭐ ${provider?.rating || '4.0'} • ${provider?.specialty || ''}</p>
                        <p>📍 ${provider?.city || ''}</p>
                    </div>
                    <span class="booking-status ${booking.status}">${statusLabel}</span>
                </div>
                <div class="booking-details">
                    <p>📅 ${date} ${booking.preferred_time ? '- ' + booking.preferred_time : ''}</p>
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:5px;">
                        <span>📞 ${provider?.phone || ''}</span>
                        ${provider?.phone ? `
                        <a href="https://wa.me/962${provider.phone.replace(/^0/, '')}" target="_blank" class="btn-whatsapp-small" title="تواصل عبر واتساب">
                            💬 واتساب
                        </a>` : ''}
                    </div>
                    ${booking.notes ? `<p>📝 ${booking.notes}</p>` : ''}
                </div>
                ${type === 'completed' ? `
                    <button class="btn btn-primary" onclick="openReviewModal('${booking.id}', '${booking.provider_id}')">
                        تقييم الخدمة ⭐
                    </button>
                ` : ''}
            </div>
        `;
    }).join('');
}

// Load user's reviews
async function loadReviews() {
    if (!currentUser) return;

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

    const container = document.getElementById('myReviewsList');

    if (!reviews || reviews.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⭐</div>
                <p>لم تقم بتقييم أي خدمة بعد</p>
            </div>
        `;
        return;
    }

    container.innerHTML = reviews.map(review => `
        <div class="review-item">
            <div class="review-header">
                <h3>${review.providers?.name || 'مقدم خدمة'}</h3>
                <span class="review-rating">${'⭐'.repeat(review.rating)}</span>
            </div>
            <p>${review.providers?.specialty || ''}</p>
            <p class="review-comment">${review.comment || 'بدون تعليق'}</p>
            <p class="review-date">${new Date(review.created_at).toLocaleDateString('ar-JO')}</p>
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

    const stars = document.querySelectorAll('#ratingStars span');
    stars.forEach((star, index) => {
        if (index < rating) {
            star.style.opacity = '1';
            star.style.transform = 'scale(1.2)';
        } else {
            star.style.opacity = '0.3';
            star.style.transform = 'scale(1)';
        }
    });
}

// Submit review
async function submitReview(e) {
    e.preventDefault();

    const bookingId = document.getElementById('reviewBookingId').value;
    const providerId = document.getElementById('reviewProviderId').value;
    const rating = parseInt(document.getElementById('ratingValue').value);
    const comment = document.getElementById('reviewComment').value;

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

        showNotification('تم إرسال التقييم بنجاح! 🎉', 'success');
        closeReviewModal();
        await loadReviews();
    } catch (err) {
        console.error('Failed to submit review:', err);
        showNotification('خطأ في إرسال التقييم', 'error');
    }
}

// Logout
async function logout() {
    await supabaseClient.auth.signOut();
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
