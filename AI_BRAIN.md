# BeBig - AI Brain

## Project Identity
- **Name**: BeBig 2.0
- **Type**: Mobile fitness and workout-tracking application.
- **Target**: iOS (Primary), Android (Secondary), Web (PWA compatible).

## Stack
- **Framework**: React Native with Expo Router.
- **State Management & Storage**: Zustand, `expo-secure-store` (Native: iOS/Android) / `IndexedDB` (`bebig_db`) with `localStorage` fallback (Web). *(Note: MMKV/SQLite is planned for future architecture)*.
- **Backend / Database**: Supabase PostgreSQL with RLS.
- **Testing**: Jest, React Native Testing Library.

## Architecture
- `app/`: Expo Router file-based routing.
- `src/features/`: Domain-isolated modules (`admin`, `auth`, `exercises`, `onboarding`, `profile`, `templates`, `workout`).
- `src/services/`: Typed API clients & Supabase sync services.
- **External Providers & Ingestion**: `WgerExerciseProvider.ts` performs direct client-side fetches (`https://wger.de/api/v2`) with local `exerciseCacheStorage` caching. *(Note: Edge Function ingestion into Supabase DB is PLANNED/FUTURE architecture)*.

## Critical Constraints & Security
- **Authentication**: Apple, Google, Email/Password via Supabase Auth.
- **Security**: PostgreSQL RLS is enabled; clients use public anonymous key with JWT.
- **Offline-First**: Active workout session persists locally via `platformStorage` / `workoutStorage` before syncing. Queues mutations offline.
- **Web Compatibility**: Must use `useNativeDriver: Platform.OS !== 'web'` for animations in `StartupSplash.tsx`.

## Standard Task Workflow
1. ANALYZE
2. LOCATE
3. PLAN (Approve when appropriate)
4. SMALL IMPLEMENTATION
5. ONE TARGETED TEST
6. USER DEVICE TEST
7. COMMIT (only when explicitly authorized)
8. REPORT
