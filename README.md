<p align="center">
  <img src="assets/bebig-only-logo.png" alt="BeBig emblem" width="128" />
</p>

<h1 align="center">BeBig 2.0</h1>

<p align="center">A local-first workout tracker for lifters who want fast logging, useful history, and reliable synchronization across web and mobile.</p>

<p align="center">
  <a href="https://be-big-2-0.vercel.app"><img src="https://img.shields.io/badge/Production-v2.4.3-16a34a?style=flat-square&logo=vercel" alt="Production v2.4.3" /></a>
  <img src="https://img.shields.io/badge/Expo-SDK%2057-000020?style=flat-square&logo=expo" alt="Expo SDK 57" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript" alt="Strict TypeScript" />
  <img src="https://img.shields.io/badge/license-proprietary-lightgrey?style=flat-square" alt="Proprietary license" />
</p>

## Product

BeBig is a cross-platform training log built with Expo, React Native, React Native Web, TypeScript, Zustand, and Supabase.

The current production release is **v2.4.3**.

Typical workflow:

1. Start as a guest or sign in.
2. Choose an exercise or create a custom movement.
3. Log sets, reps, weight, RPE/RIR, and notes.
4. Reuse templates and scheduled workouts.
5. Review history, personal records, volume, and progression.
6. Synchronize when connectivity is available.

## Production

- Web/PWA: https://be-big-2-0.vercel.app
- Release tag: v2.4.3
- Release commit: 2f88fd2
- Current static export: 45 routes

## Core capabilities

### Workout execution

- Active workout logging for weight, reps, RPE/RIR, completion state, and per-set notes.
- Add, duplicate, delete, reorder, and edit exercises and sets during a session.
- Debounced local writes with immediate flushes at critical lifecycle boundaries.
- Recovery of active, abandoned, and discarded sessions.
- Rest timer with pause, resume, skip, and +30s/-30s controls.
- Superset and giant-set utilities, exercise detail modals, and previous-performance suggestions.

### Exercises and templates

- Curated catalog with muscle-group, equipment, category, and source filtering.
- Wger provider integration with local catalog caching and media attribution.
- Custom exercise creation with instructions, target muscles, equipment, and photos.
- Reusable workout templates with ordering, target sets/reps, and quick-start flows.
- Recent-exercise support and multi-select exercise picking.
- Web image downscaling, EXIF removal, oversized legacy-photo compaction, and list-row payload stripping.

### History and performance

- Completed workout history and detailed session review.
- Volume, frequency, duration, muscle distribution, and progression analytics.
- Personal-record detection for estimated 1RM, highest weight, and session tonnage.
- Weekly performance and exercise-specific progress views.

### Accounts and privacy

- Supabase authentication with email/password and Apple sign-in support.
- Guest-first onboarding with guest-to-account migration.
- User-scoped local storage and in-memory cache isolation across account switches.
- Self-service account deletion with re-authentication and cloud-data cleanup.
- Confirmed local-device data erase.
- Privacy policy and terms at /legal/privacy and /legal/terms.

### Export and administration

- JSON, RFC 4180 CSV, PDF, and pure-TypeScript OOXML XLSX exports.
- Formula-injection neutralization in spreadsheet and CSV exports.
- Admin dashboards for users, roles, exercises, templates, monitoring, analytics, and cloud health.
- Atomic super-admin protection and transactional role mutation through Supabase SQL.

### Web and PWA reliability

- Installable static PWA with manifest, icons, and offline shell behavior.
- Shell-only service-worker navigation caching.
- Network-First JavaScript bundle delivery with guarded service-worker reload recovery.
- iOS WebKit safeguards that avoid exercise-row bitmap decoding and multi-megabyte image payloads.

## Architecture

```text
Expo Router screens
        |
        v
Feature modules and shared UI primitives
        |
        v
Zustand state + local-first storage adapters
        |
        +--> Web: IndexedDB with quota recovery
        |
        +--> Native: SecureStore for small secrets
             and FileSystem spillover for larger payloads
        |
        v
Sync services, cloud adapters, and monitoring
        |
        v
Supabase Auth, PostgreSQL/RLS, Storage, and Edge Functions
```

## Repository map

```text
app/                         Expo Router screens and layouts
src/components/              Shared UI primitives and navigation
src/constants/               Domain limits and design constants
src/features/auth/           Auth, guest mode, migration, account deletion
src/features/exercises/      Catalog, Wger, custom exercises, photos, search
src/features/export/         JSON, CSV, PDF, and OOXML export
src/features/onboarding/     Onboarding screens and state
src/features/performance/    Analytics, progression, and PR detection
src/features/profile/        Profiles, avatars, and persistence
src/features/templates/      Template creation, editing, and storage
src/features/theme/          Theme state and web synchronization
src/features/workout/        Active sessions, timers, history, and storage
src/lib/storage/             Platform and guest storage adapters
src/services/cloud/          Cloud entity services
src/services/sync/           Outbox, lifecycle, metadata, sync status
supabase/functions/          Edge Functions and shared server modules
supabase/migrations/         PostgreSQL, RLS, storage, and admin migrations
public/                      PWA manifest, icons, service worker
scripts/                     Build and manual generation utilities
tests/                       Jest and React Native Testing Library suites
```

## Security and data boundaries

- Supabase clients use the public anon key with JWT authorization; service-role credentials stay server-side.
- Row-Level Security protects user data and sync tables.
- Edge Functions use allowlisted CORS, method checks, bounded JSON, UUID/role validation, generic errors, and correlation IDs.
- Avatar storage is owner-scoped and web avatar processing strips EXIF metadata.
- vercel.json defines HSTS, Permissions-Policy, COOP, CSP, and cache controls.
- .env*, *.secret, and supabase/.temp/ are ignored by Git; only .env.example is intended to be tracked.
- Local web storage is origin-isolated but not encrypted at rest; the privacy policy documents this and the app provides local erase controls.

## Development setup

### Requirements

- Node.js 18 or newer
- npm
- Expo CLI through the project toolchain
- A Supabase project for authenticated/cloud features

### Install

```bash
git clone https://github.com/Aditya5576/BeBig-2.0.git
cd "BeBig 2.0"
npm install
copy .env.example .env.local   # Windows
# cp .env.example .env.local   # macOS/Linux
```

Configure .env.local:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Never put service-role keys, provider secrets, or deployment tokens in client environment variables.

### Common commands

```bash
npm run web
npm run ios
npm run android
npm run typecheck
npm run lint
npm test
npm run build:web
```

Focused validation:

```bash
npx jest tests/Phase3ResilienceAndHygiene.test.ts --detectOpenHandles
npx jest tests/IOSWebKitExerciseCrashGuard.test.tsx tests/AccountDeletionAndPrivacy.test.tsx tests/Phase2BSecurityHardening.test.ts --maxWorkers=2 --testTimeout=15000
```

## Release and deployment

- Vercel builds the static web export from the main branch.
- npm run build:web uses scripts/build-web.js to stamp the build with a Vercel or local Git SHA.
- GitHub Actions runs secret checks, typecheck, lint, Jest, and the production web build.
- Supabase schema changes belong in timestamped migrations.
- Edge Function and database deployment require explicit review and authorization.

## Verification notes

The current local baseline includes:

- Typecheck passing with zero errors.
- Focused security, privacy, iOS WebKit, and Phase 3 suites passing.
- Static web export producing 45 routes.
- ESLint exiting successfully, with existing warnings tracked for cleanup.

This README describes implemented repository behavior and does not claim physical-device, native-release, or penetration-test certification.

## License

Proprietary — all rights reserved.
