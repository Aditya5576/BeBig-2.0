# BeBig 2.0 — Architecture Specification

## 1. Product Direction & Vision

**BeBig** is a production-grade, public mobile fitness and workout-tracking application. Designed for serious gym lifters and fitness enthusiasts, it delivers high-performance workout tracking, seamless set-logging, intelligent rest timers, and progressive overload analytics.

---

## 2. Platform Priority

1. **iOS / iPhone (Primary Target)**:
   - Primary design language, touch targets, and interaction behaviors are tuned for iOS (dynamic islands, safe area insets, iOS navigation standards, haptic feedback conventions).
   - All features are verified first on iOS.
2. **Android (Secondary Target)**:
   - Preserves 100% functional parity across all standard Android form factors and API levels.
   - Respects predictive back gestures, Android status bar styles, and adaptive launcher icons.
   - Avoids iOS-only APIs or proprietary conventions unless abstracted cleanly through cross-platform wrappers.

---

## 3. Planned Tiered Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                 BeBig Mobile Client (React Native)               │
│                                                                  │
│  [Expo Router Navigation]  ──►  [UI Primitives & Theme Tokens]   │
│            │                                    │                │
│            ▼                                    ▼                │
│  [Feature Modules (Workouts, Exercises, History, Auth, Profile)] │
│            │                                                     │
│            ▼                                                     │
│  [Zustand Stores & Local Persistence Cache (MMKV/SQLite)]        │
│            │                                                     │
│            ▼                                                     │
│  [Service Boundaries (Typed API Clients & Supabase Adapter)]     │
└───────────────────────────────┬──────────────────────────────────┘
                                │ HTTPS / WSS
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                BeBig Backend & Integration Layer                 │
│                                                                  │
│  - Supabase PostgreSQL (Row Level Security enabled)             │
│  - Edge / Serverless API Functions                               │
│  - Third-party Data Ingestion Pipelines                          │
└───────────────────────────────▲──────────────────────────────────┘
                                │ Ingestion & Sync
                                │
┌───────────────────────────────┴──────────────────────────────────┐
│             External Providers (e.g. Wger Exercise API)          │
└──────────────────────────────────────────────────────────────────┘
```

### Decoupling External Providers (Wger Strategy)

The mobile client must **never** make direct runtime requests to Wger or rely on Wger's uptime, rate limits, or API schemas.
Instead:
$$\text{Wger} \longrightarrow \text{BeBig Integration / Ingestion Layer} \longrightarrow \text{Normalized BeBig Exercise DB} \longrightarrow \text{Mobile App}$$

**Rationale**:

- **Resilience**: Lifters in gyms with spotty cell reception cannot suffer slow or failing third-party API calls.
- **Provider Independence**: If Wger is replaced or supplemented by custom curated exercise datasets in the future, the mobile client code requires zero modification.
- **Schema Ownership**: BeBig controls its own data contracts, localized translations, equipment tags, and muscle category models.

---

## 4. Future Authentication Architecture

Authentication will support three core identity providers:

- **Apple Sign-In** (Mandatory for iOS App Store compliance when third-party OAuth is provided)
- **Google Sign-In**
- **Email / Password** (with secure magic-link / OTP recovery)

All identity providers will feed into Supabase Auth, issuing secure JWTs stored securely on the mobile device (using Expo SecureStore).

---

## 5. Future Cloud & Database Architecture

- **Database**: PostgreSQL managed by Supabase.
- **Security Model**: Strict PostgreSQL Row Level Security (RLS) policies. Every query executed by the client uses the public anonymous key with the user's JWT, restricting access to the lifter's own workouts and templates.
- **Backend Secrets**: Server-side keys (`SUPABASE_SERVICE_ROLE_KEY`) reside solely in edge functions / server environments and are never bundled into the mobile app.

---

## 6. Future Offline-First & Crash-Resilient Workouts

Gyms frequently suffer from network dead zones. An active workout session must:

- Operate completely uninterrupted when connectivity drops.
- Persist every recorded set immediately to local storage (MMKV or SQLite) before attempting cloud sync.
- Survive unexpected app termination (e.g. OS memory reclaiming, battery death) so the user can re-open BeBig and immediately resume their active workout session without losing data.
- Queue cloud mutations in an offline outbox and sync gracefully once connection resumes.

_(Note: Offline persistence and cloud sync are scheduled for future milestones.)_

---

## 7. Directory Organization

- `app/` — Expo Router file-based routing and navigation layouts
- `src/components/` — Reusable, theme-aware UI primitives (`Text`, `Button`, `Card`, `ScreenContainer`)
- `src/features/` — Domain-isolated modules (`auth`, `exercises`, `workouts`, `templates`, `history`, `analytics`, `profile`)
- `src/lib/` — Third-party library adapters and platform abstractions
- `src/services/` — Service boundaries and network layer contracts
- `src/store/` — Zustand global state slices
- `src/types/` — Shared TypeScript type declarations
- `src/constants/` — Design tokens (colors, typography, spacing, border radii)
- `src/utils/` — Pure cross-platform utility helpers
- `src/config/` — Validated environment configuration
- `assets/` — Icons, splashes, and static assets
- `tests/` — Automated Jest and React Native Testing Library suites
