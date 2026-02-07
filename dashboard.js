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

    // Initialize Chat
    if (window.initChat) {
        setTimeout(() => window.initChat(), 1000);
    }
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
async function updateUI() {
    if (!currentProvider) return;

    document.getElementById('userAvatar').textContent = currentProvider.name.substring(0, 2);
    document.getElementById('userName').textContent = currentProvider.name;
    document.getElementById('welcomeName').textContent = currentProvider.name.split(' ')[0];

    document.getElementById('profileName').value = currentProvider.name;
    document.getElementById('profileCity').value = currentProvider.city;
    document.getElementById('profileLocation').value = currentProvider.location || '';
    document.getElementById('profileBio').value = currentProvider.bio || '';

    // Load social links
    document.getElementById('socialFacebook').value = currentProvider.social_facebook || '';
    document.getElementById('socialInstagram').value = currentProvider.social_instagram || '';
    document.getElementById('socialWebsite').value = currentProvider.social_website || '';

    document.getElementById('avgRating').textContent = currentProvider.rating || '4.0';

    // Load services
    await loadServices();
}

// ... (loadServices, handleServiceToggle, loadProviderData, loadBookings, renderBookingItem, updateBookingStatus, loadReviews stay same) ...

// Update profile
async function updateProfile(e) {
    e.preventDefault();
    const btn = document.getElementById('saveProfileBtn');

    btn.disabled = true;
    btn.textContent = 'جاري الحفظ...';

    try {
        // Get form values
        const name = document.getElementById('profileName').value.trim();
        const city = document.getElementById('profileCity').value.trim();
        const location = document.getElementById('profileLocation').value.trim();
        const bio = document.getElementById('profileBio').value.trim();

        // Get social links
        const socialFacebook = document.getElementById('socialFacebook').value.trim();
        const socialInstagram = document.getElementById('socialInstagram').value.trim();
        const socialWebsite = document.getElementById('socialWebsite').value.trim();

        // Validate required fields
        if (!name || !city) {
            showNotification('الرجاء ملء جميع الحقول المطلوبة', 'warning');
            return;
        }

        console.log('Updating provider:', currentProvider.id, { name, city, location, bio });

        const { error } = await supabaseDashboard
            .from('providers')
            .update({
                name,
                city,
                location,
                bio,
                social_facebook: socialFacebook,
                social_instagram: socialInstagram,
                social_website: socialWebsite
            })
            .eq('id', currentProvider.id);

        if (error) {
            console.error('Update error details:', error);
            throw error;
        }

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
        console.error('Failed to update profile:', err);
        showNotification('خطأ: ' + (err.message || 'خطأ في حفظ التغييرات'), 'error');
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
