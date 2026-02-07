// Khedmati - Provider Dashboard
const SUPABASE_URL = 'https://rkhkvmcnjuwoxammhsqn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJraGt2bWNuanV3b3hhbW1oc3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzODk0MjcsImV4cCI6MjA4NTk2NTQyN30.iGTVKa7iap8MLZ8v0efCvzsqzviNBbacVfEDxQGDsZQ';

// Check if supabase is already defined to avoid errors
const supabaseDashboard = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// Use supabaseDashboard internally or assign to window if safe
window.supabaseClient = supabaseDashboard;

let currentUser = null;
let currentProvider = null;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await loadProviderData();
    await loadBookings();
    await loadReviews();
});

// Check authentication
async function checkAuth() {
    const { data: { session } } = await supabaseDashboard.auth.getSession();

    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    currentUser = session.user;

    // Get provider record
    let { data: provider, error } = await supabaseDashboard
        .from('providers')
        .select('*')
        .eq('user_id', currentUser.id)
        .single();

    // If no provider record exists but user has session, check if they're a provider
    if (error || !provider) {
        console.log('⚠️ No provider record found, checking profile...');

        // Check if user's profile role is 'provider'
        const { data: profile } = await supabaseDashboard
            .from('profiles')
            .select('role, full_name, phone')
            .eq('id', currentUser.id)
            .single();

        if (profile && profile.role === 'provider') {
            // User is marked as provider but record doesn't exist - create it
            console.log('📝 Creating missing provider record...');
            const { data: newProvider, error: createError } = await supabaseDashboard
                .from('providers')
                .insert([{
                    user_id: currentUser.id,
                    name: profile.full_name || currentUser.email?.split('@')[0] || 'مقدم خدمة',
                    specialty: 'صيانة عامة',
                    city: 'عمّان',
                    phone: profile.phone || '',
                    rating: 4.0,
                    review_count: 0
                }])
                .select()
                .single();

            if (createError) {
                console.error('❌ Failed to create provider record:', createError);
                showNotification('خطأ في إنشاء حساب مقدم الخدمة', 'error');
                setTimeout(() => window.location.href = 'index.html', 2000);
                return;
            }

            provider = newProvider;
            showNotification('تم إنشاء حساب مقدم الخدمة بنجاح! 🎉', 'success');
        } else {
            // Not a provider at all
            showNotification('هذه الصفحة لمقدمي الخدمات فقط', 'warning');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return;
        }
    }

    currentProvider = provider;
    updateUI();
}

// Update UI with provider data
function updateUI() {
    if (!currentProvider) return;

    document.getElementById('userAvatar').textContent = currentProvider.name.substring(0, 2);
    document.getElementById('userName').textContent = currentProvider.name;
    document.getElementById('welcomeName').textContent = currentProvider.name.split(' ')[0];

    // Profile form
    document.getElementById('profileName').value = currentProvider.name;
    document.getElementById('profileSpecialty').value = currentProvider.specialty;
    document.getElementById('profileCity').value = currentProvider.city;
    document.getElementById('profileLocation').value = currentProvider.location || '';
    document.getElementById('profileBio').value = currentProvider.bio || '';
    document.getElementById('avgRating').textContent = currentProvider.rating || '4.0';
}

// Load provider data
async function loadProviderData() {
    if (!currentProvider) return;

    // Get booking counts
    const { count: total } = await supabaseDashboard
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('provider_id', currentProvider.id);

    const { count: pending } = await supabaseDashboard
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('provider_id', currentProvider.id)
        .eq('status', 'pending');

    const { count: completed } = await supabaseDashboard
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('provider_id', currentProvider.id)
        .eq('status', 'completed');

    document.getElementById('totalBookings').textContent = total || 0;
    document.getElementById('pendingBookings').textContent = pending || 0;
    document.getElementById('completedBookings').textContent = completed || 0;
}

// Load bookings
async function loadBookings() {
    if (!currentProvider) return;

    // Pending bookings
    const { data: pending } = await supabaseDashboard
        .from('bookings')
        .select('*')
        .eq('provider_id', currentProvider.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

    const pendingList = document.getElementById('pendingBookingsList');
    if (!pending || pending.length === 0) {
        pendingList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <p>لا توجد حجوزات جديدة</p>
            </div>
        `;
    } else {
        pendingList.innerHTML = pending.map(b => renderBookingItem(b, true)).join('');
    }

    // All bookings
    const { data: all } = await supabaseDashboard
        .from('bookings')
        .select('*')
        .eq('provider_id', currentProvider.id)
        .order('created_at', { ascending: false })
        .limit(10);

    const allList = document.getElementById('allBookingsList');
    if (!all || all.length === 0) {
        allList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <p>لا توجد حجوزات بعد</p>
            </div>
        `;
    } else {
        allList.innerHTML = all.map(b => renderBookingItem(b, false)).join('');
    }
}

// Render booking item
function renderBookingItem(booking, showActions) {
    const statusLabels = {
        'pending': 'بانتظار التأكيد',
        'confirmed': 'مؤكد',
        'completed': 'مكتمل',
        'cancelled': 'ملغي'
    };

    const date = new Date(booking.service_date).toLocaleDateString('ar-JO', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    return `
        <div class="booking-item">
            <div class="booking-info">
                <div class="booking-customer">${booking.customer_name}</div>
                <div class="booking-date">📅 ${date} - ${booking.preferred_time || ''}</div>
                <div class="booking-phone">📞 ${booking.customer_phone}</div>
                ${booking.notes ? `<div class="booking-notes">📝 ${booking.notes}</div>` : ''}
            </div>
            <div class="booking-right">
                <span class="booking-status ${booking.status}">${statusLabels[booking.status] || booking.status}</span>
                ${showActions ? `
                    <div class="booking-actions">
                        <button class="btn btn-primary" onclick="updateBookingStatus('${booking.id}', 'confirmed')">تأكيد</button>
                        <button class="btn btn-ghost" onclick="updateBookingStatus('${booking.id}', 'cancelled')">رفض</button>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

// Update booking status
async function updateBookingStatus(bookingId, status) {
    try {
        const { error } = await supabaseDashboard
            .from('bookings')
            .update({ status })
            .eq('id', bookingId);

        if (error) throw error;

        showNotification(status === 'confirmed' ? 'تم تأكيد الحجز ✅' : 'تم رفض الحجز', status === 'confirmed' ? 'success' : 'info');

        await loadBookings();
        await loadProviderData();
    } catch (err) {
        showNotification('حدث خطأ', 'error');
    }
}

// Load reviews
async function loadReviews() {
    if (!currentProvider) return;

    const { data: reviews } = await supabaseDashboard
        .from('reviews')
        .select('*')
        .eq('provider_id', currentProvider.id)
        .order('created_at', { ascending: false })
        .limit(5);

    const reviewsList = document.getElementById('reviewsList');

    if (!reviews || reviews.length === 0) {
        reviewsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⭐</div>
                <p>لا توجد تقييمات بعد</p>
            </div>
        `;
    } else {
        reviewsList.innerHTML = reviews.map(review => `
            <div class="review-item" style="padding: 12px 0; border-bottom: 1px solid var(--gray-200);">
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                    <strong>${review.customer_name}</strong>
                    <span>${'⭐'.repeat(review.rating)}</span>
                </div>
                <p style="color: var(--gray-500); font-size: 0.9rem;">${review.comment || 'بدون تعليق'}</p>
            </div>
        `).join('');
    }
}

// Update profile
async function updateProfile(e) {
    e.preventDefault();
    const btn = document.getElementById('saveProfileBtn');

    btn.disabled = true;
    btn.textContent = 'جاري الحفظ...';

    try {
        const { error } = await supabaseDashboard
            .from('providers')
            .update({
                name: document.getElementById('profileName').value,
                specialty: document.getElementById('profileSpecialty').value,
                city: document.getElementById('profileCity').value,
                location: document.getElementById('profileLocation').value,
                bio: document.getElementById('profileBio').value
            })
            .eq('id', currentProvider.id);

        if (error) throw error;

        showNotification('تم حفظ التغييرات بنجاح ✅', 'success');

        // Reload data
        const { data: provider } = await supabaseDashboard
            .from('providers')
            .select('*')
            .eq('id', currentProvider.id)
            .single();

        currentProvider = provider;
        updateUI();
    } catch (err) {
        showNotification('خطأ في حفظ التغييرات', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'حفظ التغييرات';
    }
}

// Logout
async function logout() {
    await supabaseDashboard.auth.signOut();
    window.location.href = 'index.html';
}

// Notification
function showNotification(message, type = 'info') {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const colors = { success: '#22c55e', error: '#ef4444', warning: '#f59e0b', info: '#0891b2' };

    notification.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;

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
