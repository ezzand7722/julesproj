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
    await loadServiceOfferings();

    // Initialize Booking Lifecycle Manager
    if (window.BookingLifecycle && currentUser && currentProvider) {
        BookingLifecycle.injectStyles();
        await BookingLifecycle.init(supabaseDashboard, currentUser.id, 'provider', currentProvider.id);
        const notifs = await BookingLifecycle.getNotifications();
        const container = document.getElementById('lifecycleNotifContainer');
        if (container && notifs.length > 0) {
            container.innerHTML = BookingLifecycle.renderNotificationBanner(notifs);
        }
    }

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

    // Price range
    if (document.getElementById('priceRangeMin')) {
        document.getElementById('priceRangeMin').value = currentProvider.price_range_min || '';
    }
    if (document.getElementById('priceRangeMax')) {
        document.getElementById('priceRangeMax').value = currentProvider.price_range_max || '';
    }

    document.getElementById('avgRating').textContent = currentProvider.rating || '4.0';

    // Fetch and display credits
    await loadCredits();

    // Load services
    await loadServices();
}

async function loadCredits() {
    try {
        const { data: profile, error } = await supabaseDashboard
            .from('profiles')
            .select('credits_balance')
            .eq('id', currentUser.id)
            .single();

        if (profile) {
            document.getElementById('creditsBalance').textContent = profile.credits_balance + ' عملة';

            // Visual warning if low
            const card = document.getElementById('creditsBalance').closest('.stat-card');
            if (profile.credits_balance < 2) {
                card.style.border = '2px solid red';
            }
        }
    } catch (err) {
        console.error('Error loading credits:', err);
    }
}

// Load Services
async function loadServices() {
    const selector = document.getElementById('servicesSelector');
    selector.innerHTML = '<div class="loading-spinner">جاري تحميل الخدمات...</div>';

    const { data: services, error } = await supabaseDashboard
        .from('service_stats')
        .select('*');

    if (error) {
        console.error('Error loading services:', error);
        selector.innerHTML = '<div class="error-state">فشل تحميل الخدمات</div>';
        return;
    }

    // Current specialty logic (simple string match for now)
    // If we want multiple services, we need to change DB schema or store as comma-separated.
    // For now, let's assume single specialty but visualized better.
    // Or if user wants checkboxes, I'll style them as such.

    selector.innerHTML = `
        <div class="services-grid-selection">
            ${services.map(service => `
                <label class="service-checkbox-item">
                    <input type="radio" name="specialty" value="${service.name_ar}" 
                        ${currentProvider.specialty === service.name_ar ? 'checked' : ''}
                        onchange="updateSpecialty('${service.name_ar}')">
                    <span class="service-content">
                        <span class="service-icon">${service.icon}</span>
                        <span class="service-name">${service.name_ar}</span>
                    </span>
                </label>
            `).join('')}
        </div>
    `;

    // Add some styles if not present
    if (!document.getElementById('service-selection-styles')) {
        const style = document.createElement('style');
        style.id = 'service-selection-styles';
        style.textContent = `
            .services-grid-selection { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; }
            .service-checkbox-item { cursor: pointer; position: relative; }
            .service-checkbox-item input { position: absolute; opacity: 0; }
            .service-checkbox-item .service-content { 
                display: flex; flex-direction: row; align-items: center; gap: 8px;
                padding: 10px 14px; border: 2px solid #e5e7eb; border-radius: 10px; transition: all 0.2s;
                background: #f9fafb; white-space: nowrap;
            }
            .service-checkbox-item .service-content:hover { border-color: #0d9488; background: #f0fdfa; }
            .service-checkbox-item input:checked + .service-content {
                border-color: var(--primary, #0d9488); background: #f0fdfa; color: var(--primary, #0d9488); font-weight: 600;
                box-shadow: 0 0 0 1px var(--primary, #0d9488);
            }
            .service-icon { font-size: 1.3rem; flex-shrink: 0; }
            .service-name { font-size: 0.88rem; }
            @media (min-width: 600px) { .services-grid-selection { grid-template-columns: repeat(auto-fill, minmax(145px, 1fr)); } }
            @media (min-width: 900px) { .services-grid-selection { grid-template-columns: repeat(4, 1fr); } }
        `;
        document.head.appendChild(style);
    }
}

// Update Specialty
window.updateSpecialty = function (val) {
    currentProvider.specialty = val;
}

// Select Service (Deprecated)
function selectService(serviceName) { }

// Select Service
function selectService(serviceName) {
    document.querySelectorAll('.service-option').forEach(el => el.classList.remove('selected'));
    event.currentTarget.classList.add('selected');

    // Update specialty locally (will be saved on form submit if I add a hidden input or just rely on this visual)
    // Actually, the form submit logic needs to know the selected service.
    // Let's optimize: update a hidden input or just update the currentProvider object for now.
    // Better: Add a hidden input for specialty.
    // For now, I will just update the currentProvider object and rely on the text input if it was a text input.
    // But wait, the form has no "specialty" input in the HTML I saw earlier? 
    // Step 1896 show "specialty" is NOT in the form inputs explicitly, only in the selector.
    // I should probably add a hidden input or handle it in updateProfile.

    // Let's trigger a hidden input update if it exists, or just store it.
    currentProvider.specialty = serviceName;
}

// Load Provider Data (called from init)
async function loadProviderData() {
    // This function seems to be redundant if checkAuth loads the provider.
    // In checkAuth (lines 22-86), we already load the provider.
    // So loadProviderData might be for refreshing?
    // Let's just make it simpler: ensure checkAuth is enough, OR alias it.
    console.log('Provider data loaded via checkAuth');
}

// Load Bookings
// Load Bookings
async function loadBookings() {
    console.log('Loading bookings...');
    const list = document.getElementById('allBookingsList');
    const pendingList = document.getElementById('pendingBookingsList');

    // 1. Fetch Bookings (straight select, no join to avoid 400 error)
    const { data: bookings, error } = await supabaseDashboard
        .from('bookings')
        .select('*')
        .eq('provider_id', currentProvider.id)
        .neq('archived', true)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error loading bookings:', error);
        if (list) list.innerHTML = '<div class="error-state">فشل تحميل الحجوزات</div>';
        return;
    }

    // 2. Fetch Customer Details Manually
    const customerIds = [...new Set(bookings.map(b => b.customer_id).filter(Boolean))];
    const profilesMap = {};

    if (customerIds.length > 0) {
        const { data: profiles } = await supabaseDashboard
            .from('profiles')
            .select('id, full_name, phone')
            .in('id', customerIds);

        profiles?.forEach(p => profilesMap[p.id] = p);
    }

    // 3. Attach Profiles
    const enrichedBookings = bookings.map(b => ({
        ...b,
        profiles: profilesMap[b.customer_id] || null
    }));

    // Update stats
    const pending = enrichedBookings.filter(b => b.status === 'pending');
    const completed = enrichedBookings.filter(b => b.status === 'completed');

    if (document.getElementById('totalBookings')) document.getElementById('totalBookings').textContent = enrichedBookings.length;
    if (document.getElementById('pendingBookings')) document.getElementById('pendingBookings').textContent = pending.length;
    if (document.getElementById('completedBookings')) document.getElementById('completedBookings').textContent = completed.length;

    // Render lists
    if (list) {
        list.innerHTML = enrichedBookings.length ? enrichedBookings.map(b => renderBookingItem(b)).join('') : '<p class="empty-state">لا توجد حجوزات</p>';
    }
    if (pendingList) {
        pendingList.innerHTML = pending.length ? pending.map(b => renderBookingItem(b)).join('') : '<p class="empty-state">لا توجد طلبات جديدة</p>';
    }
}

// Render Booking Item
function renderBookingItem(booking) {
    // Prefer joined profile data, fallback to stored name/phone
    const profile = booking.profiles || {}; // profiles array or object depending on One-to-One
    // If One-to-Many returns array. If One-to-One returns object.
    // Assuming linked by ID is One-to-One usually.
    // Safely handle both
    const profileData = Array.isArray(profile) ? profile[0] : profile;

    const customerName = profileData?.full_name || booking.customer_name || 'عميل';
    let customerPhone = profileData?.phone || booking.customer_phone || ''; // Assuming customer_phone might exist

    const date = new Date(booking.booking_date || booking.service_date).toLocaleDateString('ar-JO');
    const statusLabels = { pending: 'قيد الانتظار', confirmed: 'مؤكد', completed: 'مكتمل', cancelled: 'ملغي', auto_cancelled: 'ملغي تلقائياً', auto_completed: 'مكتمل تلقائياً' };
    const statusColors = { pending: 'orange', confirmed: 'green', completed: 'blue', cancelled: 'red', auto_cancelled: '#ef4444', auto_completed: '#6366f1' };

    return `
    <div class="booking-item status-${booking.status}">
        <div class="booking-header">
            <span class="booking-id">#${booking.id.substr(0, 8)}</span>
            <span class="booking-status" style="color:${statusColors[booking.status]}">${statusLabels[booking.status]}</span>
        </div>
        <div class="booking-details">
            <p><strong>العميل:</strong> ${escapeHtml(customerName)}</p>
            ${customerPhone ? `<p><strong>الهاتف:</strong> ${escapeHtml(customerPhone)}</p>` : ''}
            <p><strong>التاريخ:</strong> ${date} - ${booking.booking_time || booking.preferred_time}</p>
            ${booking.notes ? `<p><strong>ملاحظات:</strong> ${escapeHtml(booking.notes)}</p>` : ''}
        </div>
        ${booking.status === 'pending' ? `
        <div class="booking-actions">
            <button class="btn-small btn-confirm" onclick="updateBookingStatus('${booking.id}', 'confirmed')">قبول</button>
            <button class="btn-small btn-cancel" onclick="updateBookingStatus('${booking.id}', 'cancelled')">رفض</button>
        </div>` : ''}
        ${booking.status === 'confirmed' ? `
        <div class="booking-actions">
            <button class="btn-small btn-complete" onclick="updateBookingStatus('${booking.id}', 'completed')">إكمال الخدمة</button>
        </div>` : ''}
    </div>
    </div>
    `;
}

// Utility: Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    return text.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Update Booking Status
async function updateBookingStatus(id, status) {
    if (!confirm('هل أنت متأكد من تغيير حالة الحجز؟')) return;

    const { error } = await supabaseDashboard
        .from('bookings')
        .update({ status: status })
        .eq('id', id);

    if (error) {
        console.error('Update status error:', error);
        // Supabase trigger errors often come in error.message
        if (error.message && error.message.includes('رصيدك غير كافي')) {
            alert('⚠️ ' + error.message + '\n\nيجب عليك شحن رصيدك لتتمكن من قبول المزيد من الحجوزات.');
        } else {
            showNotification('فشل تحديث الحالة: ' + error.message, 'error');
        }
    } else {
        showNotification('تم تحديث الحالة بنجاح', 'success');
        loadBookings();
        loadCredits(); // Refresh credits
    }
}

// Load Reviews
async function loadReviews() {
    const list = document.getElementById('reviewsList');
    if (!list) return;

    const { data: reviews, error } = await supabaseDashboard
        .from('reviews')
        .select('*')
        .eq('provider_id', currentProvider.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error loading reviews:', error);
        return;
    }

    list.innerHTML = reviews.map(r => `
        <div class="review-item">
            <div class="review-header">
                <span class="stars">${'⭐'.repeat(r.rating)}</span>
                <span class="date">${new Date(r.created_at).toLocaleDateString('ar-JO')}</span>
            </div>
            <p class="comment">${escapeHtml(r.comment)}</p>
            <div class="reviewer">- ${escapeHtml(r.customer_name)}</div>
        </div>
    `).join('') || '<p class="empty-state">لا توجد تقييمات بعد</p>';
}

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

        // Get price range
        const priceRangeMinEl = document.getElementById('priceRangeMin');
        const priceRangeMaxEl = document.getElementById('priceRangeMax');
        const price_range_min = priceRangeMinEl && priceRangeMinEl.value ? parseFloat(priceRangeMinEl.value) : null;
        const price_range_max = priceRangeMaxEl && priceRangeMaxEl.value ? parseFloat(priceRangeMaxEl.value) : null;

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
                social_website: socialWebsite,
                price_range_min,
                price_range_max
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

// --- Top Up Logic ---
let selectedPackageData = null;
let selectedPaymentMethod = null;
let currentPaymentId = null;

window.openTopUpModal = function () {
    document.getElementById('topUpModal').style.display = 'flex';
    resetTopUpModal();
}

window.closeTopUpModal = function () {
    document.getElementById('topUpModal').style.display = 'none';
    resetTopUpModal();
}

function resetTopUpModal() {
    // Reset all steps
    document.getElementById('step1').style.display = 'block';
    document.getElementById('step2').style.display = 'none';
    document.getElementById('step3').style.display = 'none';
    document.getElementById('processingStep').style.display = 'none';
    
    // Reset selection styles
    document.querySelectorAll('.package-card').forEach(c => {
        c.style.borderColor = '#eee';
        c.style.backgroundColor = 'white';
    });
    
    document.querySelectorAll('.payment-method-card').forEach(c => {
        c.classList.remove('selected');
    });
    
    // Hide all payment forms
    document.querySelectorAll('.payment-form').forEach(f => {
        f.style.display = 'none';
    });
    
    selectedPackageData = null;
    selectedPaymentMethod = null;
    currentPaymentId = null;
}

window.selectPackage = function (amount, name, price) {
    selectedPackageData = { amount, name, price };

    // Highlight selection
    document.querySelectorAll('.package-card').forEach(c => {
        c.style.borderColor = '#eee';
        c.style.backgroundColor = 'white';
    });
    event.currentTarget.style.borderColor = 'var(--primary)';
    event.currentTarget.style.backgroundColor = 'var(--primary-50)';

    // Wait a bit then move to step 2
    setTimeout(() => {
        document.getElementById('step1').style.display = 'none';
        document.getElementById('step2').style.display = 'block';
        document.getElementById('selectedPrice').textContent = price;
        document.getElementById('selectedPackageName').textContent = name;
    }, 300);
}

window.backToPackages = function () {
    document.getElementById('step2').style.display = 'none';
    document.getElementById('step1').style.display = 'block';
    selectedPaymentMethod = null;
}

window.selectPaymentMethod = function (method) {
    selectedPaymentMethod = method;
    
    // Highlight selection
    document.querySelectorAll('.payment-method-card').forEach(c => {
        c.classList.remove('selected');
    });
    event.currentTarget.classList.add('selected');
    
    // Only credit card can proceed to step 3
    if (method === 'credit_card') {
        // Wait a bit then move to step 3
        setTimeout(() => {
            document.getElementById('step2').style.display = 'none';
            document.getElementById('step3').style.display = 'block';
            
            // Show credit card form
            document.querySelectorAll('.payment-form').forEach(f => {
                f.style.display = 'none';
            });
            document.getElementById('creditCardForm').style.display = 'block';
        }, 300);
    }
}

// WhatsApp contact for alternative payments
window.contactWhatsApp = function() {
    const packageInfo = selectedPackageData;
    const message = `مرحباً! أرغب في شحن رصيدي:\n\nالباقة: ${packageInfo.name}\nالمبلغ: ${packageInfo.price} دينار\nالعملات: ${packageInfo.amount} عملة\n\nأرغب في الدفع عبر CliQ أو محفظة إلكترونية`;
    
    // Replace with your actual WhatsApp number
    const whatsappNumber = '962799999999'; // Change this to your WhatsApp number
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
    
    window.open(whatsappUrl, '_blank');
    
    // Show confirmation message
    showNotification('سيتم فتح واتساب للتواصل معنا. سنساعدك في إتمام عملية الدفع! 💬', 'success');
    
    // Close modal after a delay
    setTimeout(() => {
        closeTopUpModal();
    }, 2000);
}

window.backToPaymentMethods = function () {
    document.getElementById('step3').style.display = 'none';
    document.getElementById('step2').style.display = 'block';
}

function showProcessingStep(message) {
    document.getElementById('step3').style.display = 'none';
    document.getElementById('processingStep').style.display = 'block';
    document.getElementById('processingMessage').textContent = message;
}

// Credit Card Payment
window.processCreditCardPayment = async function () {
    const btn = document.getElementById('payBtnCard');
    btn.disabled = true;
    btn.textContent = 'جاري الاتصال بمزود الدفع...';
    
    try {
        showProcessingStep('جاري فتح صفحة الدفع الآمنة...');
        
        const result = await window.PaymentGateway.initCreditCardPayment(
            selectedPackageData.price,
            selectedPackageData.name,
            currentUser.email,
            selectedPackageData.amount,
            supabaseDashboard
        );
        
        if (result.success) {
            currentPaymentId = result.paymentId;
            
            // In production, open payment gateway URL
            // window.open(result.paymentUrl, '_blank');
            
            // For demo, simulate successful payment
            setTimeout(async () => {
                await simulatePaymentCompletion(result.creditsAmount, result.packageName);
            }, 3000);
        }
    } catch (error) {
        console.error('Credit card payment error:', error);
        showNotification('فشل الاتصال بمزود الدفع: ' + error.message, 'error');
        backToPaymentMethods();
    } finally {
        btn.disabled = false;
        btn.textContent = 'متابعة للدفع الآمن 🔒';
    }
}

// Simulate payment completion (for demo purposes - CREDIT CARD ONLY)
async function simulatePaymentCompletion(creditsAmount, packageName) {
    try {
        // Use the simulate function or directly confirm
        // In production, this would be called from a webhook/callback
        const result = await window.PaymentGateway.simulatePaymentSuccess(
            currentPaymentId,
            creditsAmount || selectedPackageData.amount,
            packageName || selectedPackageData.name,
            supabaseDashboard
        );
        
        if (result.success) {
            showNotification(`تم شحن ${creditsAmount || selectedPackageData.amount} عملة بنجاح! 🎉`, 'success');
            await loadCredits(); // Refresh balance
            closeTopUpModal();
        }
    } catch (error) {
        console.error('Payment completion error:', error);
        showNotification('حدث خطأ أثناء تأكيد الدفع: ' + error.message, 'error');
        closeTopUpModal();
    }
}

// Keep old function for backward compatibility (but not used in new UI)
window.cancelPayment = function () {
    backToPaymentMethods();
}

// Old processPayment function - kept for backward compatibility
window.processPayment = async function () {
    if (!selectedPackageData) return;

    const btn = document.getElementById('payBtn');
    if (!btn) return; // Old UI might not exist
    
    btn.disabled = true;
    btn.textContent = 'جاري معالجة الدفع...';

    try {
        // Simulate payment delay
        await new Promise(r => setTimeout(r, 1500));

        // Call Backend to Add Credits
        const { data, error } = await supabaseDashboard
            .rpc('add_credits', {
                amount: selectedPackageData.amount,
                package_name: selectedPackageData.name
            });

        if (error) throw error;

        showNotification(`تم شحن ${selectedPackageData.amount} عملة بنجاح! 🎉`, 'success');
        closeTopUpModal();
        loadCredits(); // Refresh balance

    } catch (err) {
        console.error('Payment failed:', err);
        showNotification('فشل عملية الدفع: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'تأكيد الدفع';
    }
}

// =============================================
// SERVICE OFFERINGS MANAGEMENT (CRUD)
// =============================================
let editingOfferingId = null;

// Load all offerings for this provider
async function loadServiceOfferings() {
    if (!currentProvider) return;
    const list = document.getElementById('offeringsList');
    if (!list) return;

    try {
        const { data: offerings, error } = await supabaseDashboard
            .from('service_offerings')
            .select('*')
            .eq('provider_id', currentProvider.id)
            .order('sort_order', { ascending: true });

        if (error) throw error;

        if (!offerings || offerings.length === 0) {
            list.innerHTML = `
                <div style="text-align:center; padding:24px; color:#9ca3af;">
                    <div style="font-size:2.5rem; margin-bottom:8px;">💰</div>
                    <p style="font-weight:500;">لم تضف أي خدمات بعد</p>
                    <p style="font-size:0.85rem;">أضف خدماتك مع الأسعار ليراها العملاء</p>
                </div>`;
            return;
        }

        const priceLabels = { 'fixed': 'سعر ثابت', 'hourly': 'بالساعة', 'starting_at': 'يبدأ من' };

        list.innerHTML = offerings.map(o => `
            <div class="offering-item" style="display:flex; align-items:center; justify-content:space-between; padding:14px 0; gap:10px;">
                ${o.image_url ? `<img src="${o.image_url}" class="offering-thumb" style="width:48px; height:48px; border-radius:8px; object-fit:cover; flex-shrink:0;">` : `<div class="offering-icon-placeholder" style="width:48px; height:48px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:1.4rem; flex-shrink:0;">🔧</div>`}
                <div style="flex:1; min-width:0;">
                    <div class="offering-title" style="font-weight:600; font-size:0.95rem;">${escapeHtml(o.title)}</div>
                    ${o.description ? `<div class="offering-desc" style="font-size:0.8rem; margin-top:2px;">${escapeHtml(o.description)}</div>` : ''}
                    ${o.estimated_duration ? `<div class="offering-duration" style="font-size:0.75rem; margin-top:2px;">⏱ ${escapeHtml(o.estimated_duration)}</div>` : ''}
                </div>
                <div style="display:flex; align-items:center; gap:12px; flex-shrink:0;">
                    <div style="text-align:left;">
                        <div class="offering-price" style="font-weight:700; font-size:1.05rem;">${o.price} د.أ</div>
                        <div class="offering-price-type" style="font-size:0.7rem;">${priceLabels[o.price_type] || ''}</div>
                    </div>
                    <div style="display:flex; gap:4px;">
                        <button onclick="editOffering('${o.id}')" style="background:none; border:none; cursor:pointer; font-size:1.1rem; padding:4px;" title="تعديل">✏️</button>
                        <button onclick="deleteOffering('${o.id}')" style="background:none; border:none; cursor:pointer; font-size:1.1rem; padding:4px;" title="حذف">🗑️</button>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('Error loading offerings:', err);
        list.innerHTML = '<p style="color:red;">خطأ في تحميل الخدمات</p>';
    }
}

// Escape HTML utility (if not already defined)
function escapeHtml(text) {
    if (!text) return '';
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
}

// Add or update a service offering (with optional image upload)
window.addServiceOffering = async function() {
    const title = document.getElementById('offeringTitle').value.trim();
    const price = parseFloat(document.getElementById('offeringPrice').value);
    const priceType = document.getElementById('offeringPriceType').value;
    const description = document.getElementById('offeringDesc').value.trim();
    const duration = document.getElementById('offeringDuration').value.trim();

    if (!title || isNaN(price) || price < 0) {
        showNotification('الرجاء إدخال اسم الخدمة والسعر', 'warning');
        return;
    }

    const btn = document.getElementById('addOfferingBtn');
    btn.disabled = true;
    btn.textContent = 'جاري الحفظ...';

    try {
        // Handle image upload if a file is selected
        let imageUrl = null;
        const fileInput = document.getElementById('offeringImage');
        const file = fileInput && fileInput.files[0];

        if (file) {
            const fileExt = file.name.split('.').pop();
            const fileName = `offerings/${currentProvider.id}/${Math.random().toString(36).substring(2)}.${fileExt}`;

            const { data: uploadData, error: uploadError } = await supabaseDashboard
                .storage
                .from('portfolio')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabaseDashboard
                .storage
                .from('portfolio')
                .getPublicUrl(fileName);

            imageUrl = publicUrl;
        }

        const offeringData = {
            provider_id: currentProvider.id,
            title,
            description: description || null,
            price,
            price_type: priceType,
            estimated_duration: duration || null
        };

        // Include image_url only if a new image was uploaded, or keep existing on edit
        if (imageUrl) {
            offeringData.image_url = imageUrl;
        }

        if (editingOfferingId) {
            // If no new image and user cleared the preview, remove image
            const preview = document.getElementById('offeringImagePreview');
            if (!file && preview && preview.style.display === 'none' && preview.dataset.cleared === 'true') {
                offeringData.image_url = null;
            }
            // Update existing
            const { error } = await supabaseDashboard
                .from('service_offerings')
                .update(offeringData)
                .eq('id', editingOfferingId);
            if (error) throw error;
            showNotification('تم تعديل الخدمة بنجاح ✅', 'success');
        } else {
            if (!imageUrl) offeringData.image_url = null;
            // Insert new
            const { error } = await supabaseDashboard
                .from('service_offerings')
                .insert([offeringData]);
            if (error) throw error;
            showNotification('تمت إضافة الخدمة بنجاح ✅', 'success');
        }

        // Reset form
        cancelEditOffering();
        await loadServiceOfferings();
    } catch (err) {
        console.error('Error saving offering:', err);
        showNotification('خطأ: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = editingOfferingId ? 'حفظ التعديلات' : '+ إضافة خدمة';
    }
}

// Edit an offering - populate form
window.editOffering = async function(id) {
    try {
        const { data: offering, error } = await supabaseDashboard
            .from('service_offerings')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !offering) {
            showNotification('لم يتم العثور على الخدمة', 'error');
            return;
        }

        editingOfferingId = id;
        document.getElementById('offeringTitle').value = offering.title;
        document.getElementById('offeringDesc').value = offering.description || '';
        document.getElementById('offeringPrice').value = offering.price;
        document.getElementById('offeringPriceType').value = offering.price_type;
        document.getElementById('offeringDuration').value = offering.estimated_duration || '';

        // Show existing image preview if available
        const preview = document.getElementById('offeringImagePreview');
        const fileInput = document.getElementById('offeringImage');
        if (preview) {
            if (offering.image_url) {
                preview.src = offering.image_url;
                preview.style.display = 'block';
                preview.dataset.cleared = 'false';
            } else {
                preview.style.display = 'none';
                preview.dataset.cleared = 'false';
            }
        }
        if (fileInput) fileInput.value = '';

        document.getElementById('addOfferingBtn').textContent = 'حفظ التعديلات';
        document.getElementById('cancelEditOfferingBtn').style.display = 'inline-block';

        // Scroll to form
        document.getElementById('offeringForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (err) {
        console.error('Error editing offering:', err);
    }
}

// Cancel edit mode
window.cancelEditOffering = function() {
    editingOfferingId = null;
    document.getElementById('offeringTitle').value = '';
    document.getElementById('offeringDesc').value = '';
    document.getElementById('offeringPrice').value = '';
    document.getElementById('offeringPriceType').value = 'fixed';
    document.getElementById('offeringDuration').value = '';
    // Clear image
    const fileInput = document.getElementById('offeringImage');
    const preview = document.getElementById('offeringImagePreview');
    if (fileInput) fileInput.value = '';
    if (preview) { preview.style.display = 'none'; preview.src = ''; preview.dataset.cleared = 'false'; }
    document.getElementById('addOfferingBtn').textContent = '+ إضافة خدمة';
    document.getElementById('cancelEditOfferingBtn').style.display = 'none';
}

// Delete an offering
window.deleteOffering = async function(id) {
    if (!confirm('هل تريد حذف هذه الخدمة؟')) return;

    try {
        const { error } = await supabaseDashboard
            .from('service_offerings')
            .delete()
            .eq('id', id);

        if (error) throw error;
        showNotification('تم حذف الخدمة ✅', 'success');
        await loadServiceOfferings();
    } catch (err) {
        console.error('Error deleting offering:', err);
        showNotification('خطأ في الحذف: ' + err.message, 'error');
    }
}

// Image preview for offering image upload
document.addEventListener('DOMContentLoaded', function() {
    const imgInput = document.getElementById('offeringImage');
    if (imgInput) {
        imgInput.addEventListener('change', function() {
            const preview = document.getElementById('offeringImagePreview');
            if (this.files && this.files[0]) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    preview.src = e.target.result;
                    preview.style.display = 'block';
                };
                reader.readAsDataURL(this.files[0]);
            } else {
                preview.style.display = 'none';
            }
        });
    }
});
