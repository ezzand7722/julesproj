// Khedmati - Authentication System
const SUPABASE_URL = 'https://rkhkvmcnjuwoxammhsqn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJraGt2bWNuanV3b3hhbW1oc3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzODk0MjcsImV4cCI6MjA4NTk2NTQyN30.iGTVKa7iap8MLZ8v0efCvzsqzviNBbacVfEDxQGDsZQ';

let supabaseClient;

// Initialize Supabase safely
try {
    if (window.supabase) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase initialized successfully');
    } else {
        console.error('❌ Supabase library not found! Check your internet connection.');
        showNotification('فشل تحميل النظام. تأكد من الاتصال بالإنترنت', 'error');
    }
} catch (err) {
    console.error('❌ Error initializing Supabase:', err);
}

// Ensure functions are global
window.showForm = showForm;
window.setUserType = setUserType;
window.handleLogin = handleLogin;
window.handleSignup = handleSignup;
window.signInWithGoogle = signInWithGoogle;
window.togglePassword = togglePassword;

// Check Login State
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Auth page loaded');
    if (!supabaseClient) return;

    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            console.log('👤 User already logged in, checking profile...');

            // Check if user selected 'provider' before Google OAuth redirect
            const pendingUserType = localStorage.getItem('pendingUserType');
            if (pendingUserType === 'provider') {
                console.log('📝 Updating role to provider from Google OAuth...');
                await supabaseClient
                    .from('profiles')
                    .update({ role: 'provider' })
                    .eq('id', session.user.id);
                localStorage.removeItem('pendingUserType');
                window.location.href = 'dashboard.html';
                return;
            }
            localStorage.removeItem('pendingUserType');

            // Check if there's pending provider data from email signup
            const pendingProviderData = localStorage.getItem('pendingProviderData');
            if (pendingProviderData) {
                console.log('📝 Creating provider record from email signup...');
                const providerData = JSON.parse(pendingProviderData);

                // First update profile role
                await supabaseClient
                    .from('profiles')
                    .update({ role: 'provider' })
                    .eq('id', session.user.id);

                // Then create provider record
                const { error: providerError } = await supabaseClient
                    .from('providers')
                    .insert([{
                        user_id: session.user.id,
                        name: providerData.name,
                        specialty: providerData.specialty,
                        city: providerData.city,
                        location: providerData.location,
                        phone: providerData.phone,
                        rating: 4.0,
                        review_count: 0,
                        is_featured: false,
                        is_verified: false
                    }]);

                if (providerError) {
                    console.error('Provider insert error:', providerError);
                } else {
                    console.log('✅ Provider record created successfully');
                }
                localStorage.removeItem('pendingProviderData');
                window.location.href = 'dashboard.html';
                return;
            }

            const { data: profile } = await supabaseClient
                .from('profiles')
                .select('role')
                .eq('id', session.user.id)
                .single();

            if (profile && profile.role === 'provider') {
                // Providers stay on homepage too (manual navigation to dashboard)
                window.location.href = 'index.html';
            } else {
                // Customers stay on homepage
                window.location.href = 'index.html';
            }
        }
    } catch (err) {
        console.error('⚠️ Error checking session:', err);
    }
});

// UI Functions (Defined outside try/catch to ensure availability)

function showForm(formId) {
    console.log('Show form:', formId);
    document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
    document.getElementById(formId).classList.add('active');
}

function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    input.type = input.type === 'password' ? 'text' : 'password';
}

function setUserType(type, e) {
    console.log('Set user type:', type);
    document.getElementById('userType').value = type;
    document.querySelectorAll('.type-btn').forEach(btn => btn.classList.remove('active'));

    if (e && e.target) {
        e.target.classList.add('active');
    } else {
        // Fallback if event is missing
        const buttons = document.querySelectorAll('.type-btn');
        if (type === 'customer') buttons[0].classList.add('active');
        if (type === 'provider') buttons[1].classList.add('active');
    }

    const providerFields = document.getElementById('providerFields');
    if (type === 'provider') {
        providerFields.classList.remove('hidden');
    } else {
        providerFields.classList.add('hidden');
    }
}

// Handlers

async function handleLogin(e) {
    e.preventDefault();
    if (!supabaseClient) {
        showNotification('النظام غير متصل. يرجى تحديث الصفحة.', 'error');
        return;
    }

    const btn = document.getElementById('loginBtn');
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    btn.disabled = true;
    btn.textContent = 'جاري تسجيل الدخول...';

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

        if (error) throw error;

        // Check Profile Role
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .single();

        if (profile && profile.role === 'provider') {
            window.location.href = 'dashboard.html';
        } else {
            window.location.href = 'index.html';
        }
    } catch (err) {
        console.error('Login error:', err);
        // Check for specific error types
        if (err.message && err.message.includes('Email not confirmed')) {
            showNotification('يرجى تفعيل حسابك من البريد الإلكتروني أولاً', 'warning');
        } else if (err.message && err.message.includes('Invalid login credentials')) {
            showNotification('البريد الإلكتروني أو كلمة المرور غير صحيحة', 'error');
        } else {
            showNotification(err.message || 'خطأ في تسجيل الدخول', 'error');
        }
    } finally {
        btn.disabled = false;
        btn.textContent = 'تسجيل الدخول';
    }
}

async function handleSignup(e) {
    e.preventDefault();
    if (!supabaseClient) {
        showNotification('النظام غير متصل. يرجى تحديث الصفحة.', 'error');
        return;
    }

    const btn = document.getElementById('signupBtn');
    const userType = document.getElementById('userType').value;
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const phone = document.getElementById('signupPhone').value;
    const password = document.getElementById('signupPassword').value;

    btn.disabled = true;
    btn.textContent = 'جاري إنشاء الحساب...';

    try {
        // Check for duplicate email in profiles
        const { data: existingEmail } = await supabaseClient
            .from('profiles')
            .select('email')
            .eq('email', email)
            .maybeSingle();

        if (existingEmail) {
            throw new Error('هذا البريد الإلكتروني مسجل بالفعل. جرب تسجيل الدخول.');
        }

        // Check for duplicate phone in profiles
        const { data: existingPhone } = await supabaseClient
            .from('profiles')
            .select('phone')
            .eq('phone', phone)
            .maybeSingle();

        if (existingPhone) {
            throw new Error('رقم الهاتف مسجل بالفعل. استخدم رقم هاتف آخر.');
        }

        // Sign up user
        const { data: authData, error: authError } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: name, phone, user_type: userType }
            }
        });

        if (authError) throw authError;

        // If provider, save provider data to localStorage for later processing
        if (userType === 'provider') {
            const specialty = document.getElementById('providerSpecialty').value;
            const city = document.getElementById('providerCity').value;
            const location = document.getElementById('providerLocation').value;

            if (!specialty || !city) {
                throw new Error('الرجاء اختيار التخصص والمدينة');
            }

            // Store provider data for after email verification/first login
            localStorage.setItem('pendingProviderData', JSON.stringify({
                specialty, city, location: location || city, phone, name
            }));
        }

        if (authData.user && !authData.session) {
            console.log('✅ Signup successful, confirmation email sent');
            document.getElementById('successText').textContent = 'تم إنشاء الحساب بنجاح! يرجى الذهاب لبريدك الإلكتروني وتفعيل الحساب للدخول.';
        } else {
            console.log('✅ Signup successful, session created');
            document.getElementById('successText').textContent = 'تم إنشاء الحساب بنجاح!';
        }
        showForm('successMessage');

    } catch (err) {
        console.error('Signup error:', err);
        showNotification(err.message || 'خطأ في إنشاء الحساب', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'إنشاء الحساب';
    }
}

async function signInWithGoogle() {
    if (window.location.protocol === 'file:') {
        alert('⚠️ تنبيه: تسجيل الدخول بـ Google لا يعمل عند فتح الملف مباشرة.\n\nيجب تشغيل الموقع باستخدام خادم محلي (Local Server) مثل "Live Server" في VS Code.\n\nالبروتوكول الحالي: file://');
        return;
    }

    if (!supabaseClient) {
        showNotification('النظام غير متصل. يرجى تحديث الصفحة.', 'error');
        return;
    }

    // Save user type selection to localStorage before redirect
    const userTypeElement = document.getElementById('userType');
    const selectedUserType = userTypeElement ? userTypeElement.value : 'customer';
    localStorage.setItem('pendingUserType', selectedUserType);
    console.log('💾 Saved pending user type:', selectedUserType);

    try {
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: new URL('login.html', window.location.href).href, // Return to login to process
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent',
                },
            }
        });

        if (error) throw error;
        console.log('Google sign-in initiated:', data);
    } catch (err) {
        console.error('Error logging in:', err.message);
        showNotification('خطأ في تسجيل الدخول بحساب Google', 'error');
    }
}

function showNotification(message, type = 'info') {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;

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
    }, 4000);
}
