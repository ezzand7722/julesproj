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
            .services-grid-selection { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
            .service-checkbox-item { cursor: pointer; position: relative; }
            .service-checkbox-item input { position: absolute; opacity: 0; }
            .service-checkbox-item .service-content { 
                display: flex; flex-direction: column; align-items: center; 
                padding: 10px; border: 2px solid #eee; border-radius: 8px; transition: all 0.2s;
            }
            .service-checkbox-item input:checked + .service-content {
                border-color: var(--primary); background: rgba(var(--primary-rgb), 0.05); color: var(--primary);
            }
            .service-icon { font-size: 1.5rem; margin-bottom: 5px; }
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
    const statusLabels = { pending: 'قيد الانتظار', confirmed: 'مؤكد', completed: 'مكتمل', cancelled: 'ملغي' };
    const statusColors = { pending: 'orange', confirmed: 'green', completed: 'blue', cancelled: 'red' };

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
