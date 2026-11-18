# BeBig - AI Brain

## Project Identity
- **Name**: BeBig 2.0
- **Type**: Mobile fitness and workout-tracking application.
- **Target**: iOS (Primary), Android (Secondary), Web (PWA compatible — https://be-big-2-0.vercel.app).
- **Live Production Version**: `v2.4.2` (`0afb94b` / tag `v2.4.2`).

## Stack
- **Framework**: React Native (`0.86.3`) with Expo SDK `~57.0.25` and Expo Router (45 static web routes).
- **State Management & Storage**:
  - Zustand for auth, onboarding, and theme state.
  - **Web (PWA)**: `IndexedDB` (`bebig_db`, store `keyval`) with transparent `localStorage` migration, automatic `QuotaExceededError` eviction of rebuildable exercise catalog caches, and sanitized storage-fault telemetry (`AUD-018`).
  - **Native (iOS / Android)**: `expo-secure-store` (Keychain / KeyStore) for small tokens (`<= 1800` bytes) with transparent durable spillover to app-private `FileSystem.documentDirectory/bebig_kv/` for large workout/template payloads (`AUD-017`). *(SQLite migration remains planned for future native-scale milestones)*.
- **Backend / Database**: Supabase PostgreSQL with Row-Level Security (RLS) (`gkkvxfroxthvbiecramm`, `ap-northeast-1`).
- **Exports**: Zero-dependency pure-TypeScript OOXML `.xlsx` writer (`ooxmlWorkbook.ts`, with formula-injection neutralization, `AUD-005`), `pdf-lib` PDF reports, JSON, and RFC 4180 CSV.
- **PWA & Security**: Shell-only Service Worker (`public/sw.js`, `bebig-pwa-v2.4.2`, `AUD-013`), HSTS + `Permissions-Policy` + COOP + CSP (`vercel.json`, `AUD-012`), origin-allowlisted Edge Functions (`supabase/functions/_shared/security.ts`, `AUD-010`), self-service account deletion (`delete-account`, `AUD-006`), legal routes (`/legal/privacy`, `/legal/terms`, `AUD-007`), and confirmed local device wipe (`AUD-011`).
- **Media & iOS WebKit Safety**: Exercise list rows (`ExercisePickerModal` and `/exercises`) render pure-SVG badges (`hideThumbnail={true}`, 0 decoded `<Image>` bitmaps) to prevent iOS Safari Jetsam crashes; web photo & avatar uploads are EXIF-stripped and downscaled via offscreen `HTMLCanvasElement` to `<= 800px` JPEG (`0.82`) (`AUD-020`).
- **External Providers**: `WgerExerciseProvider.ts` performs direct client-side fetches (`https://wger.de/api/v2`) with local `exerciseCacheStorage` caching and curated media catalog (`281` verified CC-BY-SA entries).
- **Testing & CI**: Jest + React Native Testing Library (`--maxWorkers=2 --testTimeout=15000 --forceExit`), GitHub Actions CI gate (`.github/workflows/ci.yml`, `AUD-004`).

## Architecture
- `app/`: Expo Router file-based routing (including `/legal/privacy`, `/legal/terms`, `/workout/active`, `/exercises`, `/settings`, `/admin/*`).
- `src/features/`: Domain-isolated modules (`admin`, `auth`, `exercises`, `export`, `onboarding`, `performance`, `profile`, `templates`, `theme`, `workout`).
- `src/constants/domainLimits.ts`: Canonical input length & collection bounds (`AUD-024`).
- `src/services/`: Typed API clients & Supabase LWW/tombstone sync services.

## Critical Constraints & Security
- **Authentication**: Apple, Google, Email/Password via Supabase Auth.
- **Security**: PostgreSQL RLS enabled; clients use anon key with JWT; zero tracked `.env*` or `supabase/.temp/` files (`AUD-001`).
- **Offline-First**: Active workout session persists locally via `platformStorage` / `workoutStorage` with FIFO serialization, discard tombstones, and atomic CAS session tokens before syncing.
- **Permanent Exclusion**: NEVER modify `app/+html.tsx` (`AUD-008` pinch-to-zoom/viewport locking).
- **Paused Boundaries**: Never modify deferred M2 timer-notification code or paused AI Coach V2 files (`app/coach/`, `src/features/coach/`, `supabase/functions/coach-v2/`).
- **Web Compatibility**: Must use `useNativeDriver: Platform.OS !== 'web'` for animations in `StartupSplash.tsx` and `removeClippedSubviews={Platform.OS !== 'web'}` on web `FlatList`s.

## Standard Task Workflow
1. ANALYZE
2. LOCATE
3. PLAN (Approve when appropriate)
4. SMALL IMPLEMENTATION
5. TARGETED & FULL VERIFICATION
6. USER DEVICE TEST
7. COMMIT / DEPLOY (only when explicitly authorized)
8. REPORT
