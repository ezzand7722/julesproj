# Security & Data Protection Report

## Overview
This document outlines the security measures implemented in the Khedmati platform, including Row Level Security (RLS) policies, input sanitization, and data protection practices.

## 1. Row Level Security (RLS)
We use Supabase's RLS to restrict data access at the database level.

### Current Policies:

#### Public Data (Read-Only)
- **Providers & Services:** Visible to everyone (authenticated or anonymous).
- **Reviews:** Visible to everyone.

#### Private Data (Protected)
- **Bookings:**
  - **View:** Users can only view their own bookings (`auth.uid() = customer_id`).
  - **Create:** Authenticated users can create bookings.
  - **Update:** Users can only update specific fields (e.g., `reviewed` status) on their own bookings.
- **Profiles:**
  - Users can read/update their own profile.
  - Admins can read (but not modify) all profiles.

#### Admin Privileges
- Admins (identified by `is_admin = true` in `profiles` table) have:
  - Full read access to all bookings.
  - Delete access to bookings (for moderation).
  - Read access to all profiles.

## 2. Input Sanitization (XSS Prevention)
To prevent Cross-Site Scripting (XSS) attacks where malicious scripts are injected into the browser:

- **Strict Content Escaping:** All dynamic data rendered into the DOM using `innerHTML` is passed through an `escapeHtml()` function.
- **Escaped Characters:**
  - `&` &rarr; `&amp;`
  - `<` &rarr; `&lt;`
  - `>` &rarr; `&gt;`
  - `"` &rarr; `&quot;`
  - `'` &rarr; `&#039;`
- **Affected Components:**
  - Service Cards
  - Provider Cards
  - Review/Testimonial Text
  - Provider Profile Details

## 3. API Security
- **Anon Key:** The public API key is safe to be exposed as it is restricted by RLS policies.
- **Service Role Key:** Never exposed on the client side. Used only for administrative tasks in backend scripts.

## 4. Recommendations
- **Regular Audit:** Periodically review RLS policies as new features are added.
- **Content Security Policy (CSP):** Consider implementing CSP headers in the future to further restrict script execution sources.
