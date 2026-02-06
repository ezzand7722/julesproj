# إعداد تسجيل الدخول بحساب Google - Khedmati

## الخطوات المطلوبة لتفعيل تسجيل الدخول بـ Google

### 1. إنشاء مشروع في Google Cloud Console

1. اذهب إلى [Google Cloud Console](https://console.cloud.google.com/)
2. أنشئ مشروع جديد أو اختر مشروع موجود
3. من القائمة الجانبية اختر **APIs & Services** > **OAuth consent screen**
4. اختر **External** ثم اضغط **Create**
5. املأ البيانات المطلوبة:
   - **App name**: Khedmati
   - **User support email**: بريدك الإلكتروني
   - **Developer contact**: بريدك الإلكتروني
6. اضغط **Save and Continue**

### 2. إنشاء OAuth Client ID

1. من القائمة الجانبية اختر **APIs & Services** > **Credentials**
2. اضغط **+ CREATE CREDENTIALS** > **OAuth client ID**
3. اختر **Web application**
4. أضف الاسم: `Khedmati Web Client`
5. في **Authorized JavaScript origins** أضف:
   ```
   http://localhost
   http://127.0.0.1
   https://globdesovygfvvyuzrvy.supabase.co
   ```
6. في **Authorized redirect URIs** أضف:
   ```
   https://globdesovygfvvyuzrvy.supabase.co/auth/v1/callback
   ```
7. اضغط **CREATE**
8. **احفظ Client ID و Client Secret** - ستحتاجهم للخطوة التالية

### 3. تفعيل Google في Supabase Dashboard

1. اذهب إلى [Supabase Dashboard](https://supabase.com/dashboard)
2. اختر مشروعك `globdesovygfvvyuzrvy`
3. من القائمة الجانبية اختر **Authentication** > **Providers**
4. ابحث عن **Google** واضغط عليه
5. فعّل **Enable Sign in with Google**
6. أضف **Client ID** و **Client Secret** من الخطوة السابقة
7. اضغط **Save**

### 4. إعدادات إضافية (اختياري)

#### تفعيل Site URL
1. في Supabase Dashboard اذهب إلى **Authentication** > **URL Configuration**
2. أضف Site URL الخاص بموقعك

#### إذا كنت تستخدم localhost للتطوير
- أضف `http://localhost:5500` (أو المنفذ الذي تستخدمه) إلى **Redirect URLs**

---

## اختبار التسجيل بـ Google

بعد إكمال الإعداد:
1. افتح `login.html`
2. اضغط زر **تسجيل الدخول بحساب Google**
3. ستظهر نافذة Google للتسجيل
4. بعد التسجيل بنجاح سيتم توجيهك للوحة التحكم

---

## ملاحظات مهمة

> ⚠️ **تحذير**: لا تشارك Client Secret مع أي شخص
> 
> 📧 **البريد**: يجب تفعيل البريد الإلكتروني في إعدادات Authentication
>
> 🔒 **الأمان**: تأكد من إضافة جميع الـ URLs المستخدمة في Authorized Origins

---

## روابط مفيدة

- [Supabase Google Auth Docs](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Google Cloud Console](https://console.cloud.google.com/)
- [Supabase Dashboard](https://supabase.com/dashboard/project/globdesovygfvvyuzrvy/auth/providers)
