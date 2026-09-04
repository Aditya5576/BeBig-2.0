# BeBig 2.0 — Supabase Backend & Authentication Setup Guide

This guide details the complete configuration required for **Supabase**, **Email Auth**, **Google OAuth**, and **Apple Sign In** in **BeBig 2.0**.

---

## 1. Architecture & Security Model

```
Mobile App (iOS / Android)
  ├── Expo SecureStore (Encrypted JWT token storage in Keychain / KeyStore)
  ├── Supabase Client (Initialized with Public Anon Key ONLY)
  ├── AuthService (Email, Apple, Google)
  └── ProfileService (Syncs onboarding choices to PostgreSQL)
         │
         ▼ (HTTPS / WSS)
Supabase Cloud
  ├── Supabase Auth (Manages auth.users, identity tokens, sessions)
  └── PostgreSQL Database
        └── public.profiles (Row Level Security strictly enforced)
```

### Critical Security Rule

- **ONLY** `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are allowed in the mobile application.
- **NEVER** place the `SUPABASE_SERVICE_ROLE_KEY`, database admin passwords, or OAuth client secrets in this mobile repository or in client `.env` files.

---

## 2. Environment Configuration

1. In the project root, copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Populate the Supabase values from your **Supabase Dashboard → Project Settings → API**:
   ```env
   EXPO_PUBLIC_APP_ENV=development
   EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-public-anon-key>
   ```

---

## 3. Database Migration & Schema

The SQL migration is stored at:
`supabase/migrations/20260903000000_create_profiles_table.sql`

### How to apply the migration:

#### Option A: Supabase Dashboard (Recommended for Quick Setup)

1. Open your [Supabase Dashboard](https://app.supabase.com).
2. Navigate to **SQL Editor** in the left sidebar.
3. Click **New Query**.
4. Copy the entire contents of `supabase/migrations/20260903000000_create_profiles_table.sql` and paste it into the editor.
5. Click **Run**.

#### Option B: Supabase CLI

```bash
supabase db push
# or
supabase migration up
```

### Row Level Security (RLS) Policies

The `profiles` table has RLS enabled by default with the following strict policies:

- **SELECT (`Users can view own profile`)**: `auth.uid() = id`
- **INSERT (`Users can insert own profile`)**: `auth.uid() = id`
- **UPDATE (`Users can update own profile`)**: `auth.uid() = id`

_Users can NEVER read, create, or modify any other user's profile through the client API._

---

## 4. Email Authentication & URL Configuration Setup

Email authentication is enabled by default in Supabase projects.

### Step 1: Fix Site URL & Add Mobile Redirect URLs

By default, newly created Supabase projects set **Site URL** to `http://localhost:3000`. When a user clicks an email confirmation link on a mobile device, Supabase redirects them to the Site URL if no mobile redirect is configured.

To ensure the confirmation link opens the BeBig mobile app on physical devices:

1. Open **Supabase Dashboard → Authentication → URL Configuration**.
2. **Site URL**:
   - Change from `http://localhost:3000` to:
     `bebig://auth/callback`
3. **Redirect URLs** (Whitelisted callback destinations):
   - Add:
     - `bebig://auth/callback` (for standalone/production iOS & Android builds)
     - `bebig://**`
     - `exp://**` (allows Expo Go development on local WiFi / tunnel)
     - `https://<your-project-ref>.supabase.co/auth/v1/callback`
4. Click **Save**.

### Step 2: Email Provider Settings

1. Go to **Supabase Dashboard → Authentication → Providers → Email**.
2. Ensure **Enable Email provider** is switched **ON**.
3. **Confirm email** setting:
   - **Production**: Enable "Confirm email". When enabled, BeBig sends the confirmation email with `emailRedirectTo: getAuthRedirectUrl()`. Tapping the link in iOS Mail/Safari directs the user back into BeBig, confirming their account and logging them in automatically.
4. **Minimum password length**: Supabase defaults to 6 characters, matching BeBig's client validation.

### Step 3: Verify Email Templates

1. Go to **Supabase Dashboard → Authentication → Email Templates**.
2. Select **Confirm signup**.
3. Verify the button/link uses the default Supabase confirmation URL variable:
   ```html
   <h2>Confirm your signup</h2>
   <p>Follow this link to confirm your user:</p>
   <p><a href="{{ .ConfirmationURL }}">Confirm your mail</a></p>
   ```
4. **How this works on physical devices**:
   - Supabase generates `{{ .ConfirmationURL }}` pointing to `https://<project-ref>.supabase.co/auth/v1/verify?token=...&type=signup&redirect_to={{ .RedirectTo }}`.
   - BeBig passes `emailRedirectTo: getAuthRedirectUrl()` (e.g. `bebig://auth/callback` in production or `exp://...` in Expo Go).
   - When the athlete taps the link in their mail client, Supabase verifies the token on the server and redirects (HTTP 302) to `bebig://auth/callback?code=...`.
   - iOS opens the BeBig app directly via its URL scheme (`bebig://`).
   - If the Redirect URL was NOT whitelisted in Step 1, Supabase falls back to the Site URL (`http://localhost:3000`). Setting Site URL to `bebig://auth/callback` and adding `bebig://**` guarantees it will never redirect to `localhost:3000`.

---

## 5. Google OAuth Setup

### Step 1: Google Cloud Console

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project named **BeBig**.
3. Configure the **OAuth Consent Screen** (App name: BeBig, User support email, Developer contact email).
4. Navigate to **Credentials → Create Credentials → OAuth client ID**.
5. Select Application type: **Web application**.
6. Under **Authorized redirect URIs**, add your Supabase project callback URL:
   `https://<your-project-ref>.supabase.co/auth/v1/callback`
7. Save and copy the **Client ID** and **Client Secret**.

### Step 2: Supabase Dashboard

1. Go to **Authentication → Providers → Google**.
2. Turn **Google Enabled** to **ON**.
3. Paste the **Client ID** and **Client Secret** obtained from Google Cloud Console.
4. Save changes.

### Step 3: Deep Link Callback Configuration

1. Go to **Authentication → URL Configuration → Redirect URLs**.
2. Add:
   - `bebig://auth/callback`
   - `exp://*` (for Expo Go local testing)

---

## 6. Sign in with Apple Setup

### Step 1: Apple Developer Portal

1. Go to the [Apple Developer Account](https://developer.apple.com/account).
2. Under **Certificates, Identifiers & Profiles**:
   - **App ID**: Verify `com.aditya.bebig` has the **Sign in with Apple** capability enabled.
   - **Services ID**: Create a Services ID (e.g. `com.aditya.bebig.auth`). Configure Sign in with Apple with:
     - **Primary App ID**: `com.aditya.bebig`
     - **Website URLs**:
       - Domains: `<your-project-ref>.supabase.co`
       - Return URLs: `https://<your-project-ref>.supabase.co/auth/v1/callback`
   - **Keys**: Create a new Key with **Sign in with Apple** enabled. Download the `.p8` private key file and note the **Key ID** and **Team ID**.

### Step 2: Supabase Dashboard

1. Go to **Authentication → Providers → Apple**.
2. Turn **Apple Enabled** to **ON**.
3. Configure:
   - **Services ID**: `com.aditya.bebig.auth`
   - **Team ID**: Your 10-character Apple Developer Team ID
   - **Key ID**: The Key ID for your `.p8` key
   - **Secret Key (p8)**: Paste the contents of the downloaded `.p8` key file.
4. Save changes.

---

## 7. Status Summary

| Provider / Feature           |      Application Code Status       | External Configuration Status                                 |
| ---------------------------- | :--------------------------------: | ------------------------------------------------------------- |
| **Email Sign In**            |        ✅ Fully Implemented        | Enabled by default in Supabase                                |
| **Email Sign Up**            |        ✅ Fully Implemented        | Enabled by default in Supabase                                |
| **Email Sign Out**           |        ✅ Fully Implemented        | Native Supabase session termination                           |
| **Google OAuth**             |        ✅ Fully Implemented        | Requires Google Cloud Client ID & Secret in Supabase          |
| **Apple Sign In**            |        ✅ Fully Implemented        | Requires Apple Developer Portal Services ID & Key in Supabase |
| **Secure Token Storage**     |        ✅ Fully Implemented        | Uses Expo SecureStore (iOS Keychain / Android KeyStore)       |
| **Database Migration**       | ✅ Ready in `supabase/migrations/` | Ready to apply in Supabase SQL Editor                         |
| **Row Level Security (RLS)** | ✅ Ready in `supabase/migrations/` | Enforced at database engine layer                             |
| **Cloud Profile Sync**       |        ✅ Fully Implemented        | Upserts onboarding choices to `profiles` table                |
