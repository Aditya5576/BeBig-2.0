# BeBig 2.0 — Release State

## Production (Live Verified)

- **URL**: https://be-big-2-0.vercel.app
- **Configured Version**: v2.4.1 (`package.json`, `app.json`)
- **Target Release Tag**: `v2.4.1`
- **Deployment Status**: Ready for Production Release
- **Deployment Method**: Automatic Vercel deployment on `main` branch push

## Deployed Features in Production (v2.4.1)
- **iOS WebKit Crash Guard**: Inline single-layer overlay replacing web modal portals with dynamic `100dvh` iOS keyboard compensation and multi-event teardown (`popstate`, `keydown`, `unmount`)
- **Jetsam Memory Defense**: Bounded `FlatList` virtualization, capped header recents, and lazy decoding thumbnail suppression in compact picker mode
- **SPA Routing Resilience**: Vercel route ordering (`/exercises/new` ahead of `:id`), asset exclusion regex, and Service Worker navigation fallback on 404/network drop
- **Granular Error Boundary**: Component-level fallback catching isolated card errors without disrupting workout sessions
- **Versioned "What's New in v2.4.1" Modal**: Once-per-version update acknowledgement modal highlighting v2.4.1 capabilities

## Historical Releases
### Deployed Features in Production (v2.4.0)

- **Cinematic Startup Sequence**: 3.5s multi-stage Obsidian Athletic splash screen with progressive-overload barbell asset, ambient Electric Blue / Emerald breathing glow, and hardware-accelerated progress bar
- **BrandLogoBadge Architecture**: Framed `#131B2E` Obsidian Athletic emblem badges with Electric Blue border glow across Home, Settings, and Onboarding headers
- **Athletic Typography Upgrade**: App-wide integration of `Plus Jakarta Sans` (headings, body, badges) and `JetBrains Mono` (high-precision tabular workout metrics and timers)
- **Instant Multi-Word Custom Search**: Cold-start cache hydration and order-independent keyword tokenization delivering 0ms custom movement resolution
- **Resilient Summary Recovery**: Safe session resolution and missing-param guards preventing 404 dead-ends on `/workout/summary`
- **Versioned "What's New in v2.4.0" Modal**: Once-per-version update acknowledgement modal highlighting v2.4.0 capabilities

## Historical Releases

### Deployed Features in Production (v2.1.1 · b511ab6)

- **Task 1**: Automatic workout-template session numbering (`Session #1`, `Session #2`)
- **Task 2**: Profile photo upload, cropping, and cross-platform persistence
- **Task 3**: Recently used exercises in the exercise picker
- **Task 4**: Genuine Excel (.xlsx) and PDF (.pdf) export for history and templates
- **Task 5**: Progress Analytics 2.0, weekly performance trends, & AI Weekly Analysis
- **Task 6**: iOS and Android workout/rest-timer background notifications
- **PR #5 Hotfix**: Profile black screen fix (deferred heavy export imports), PDF WinAnsi Unicode fix (U+202F), and iOS `timeSensitive` notification registration
- **Prior Foundation**: Workout 2.0 athlete experience, Rest Timer UI polish, Exercise Library, CSP configuration

## Development Status (Pending / Local Work)

- **Current Working Branch**: `feat/m1-remove-scheduled-workouts`
- **Current HEAD**: `b511ab6b2158c3c57bde95904b1765868d5b3958`
- **Pending Uncommitted Milestones**:
  - **M1 (Removal)**: Safely remove scheduled workouts (local verification complete, uncommitted)
  - **M3 (Optimization)**: Bounded AI Coach history query & lifetime volume preservation (local verification complete, uncommitted)
  - **What's New Popup**: Version-aware release notes modal with onboarding protection (local verification complete, uncommitted)
  - **M4 (Audit)**: Avatar storage privacy audit & path sanitization (local verification complete, uncommitted)
- **M2 Milestone**: Workout/rest-timer notifications audit (explicitly deferred)

## Release Rule

1. Test production end-to-end on physical device during gym usage.
2. Record any production issues.
3. Fix production issues if discovered.

> **Important**: Do not delete or overwrite this state file during normal development.
