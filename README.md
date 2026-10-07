# BeBig 2.0 🏋️‍♂️

A production-grade, local-first gym workout tracking Progressive Web Application (PWA) and mobile platform engineered for serious lifters, strength athletes, and fitness enthusiasts. Built with Expo, React Native, TypeScript, Supabase, and resilient offline-first storage.

[![Production App](https://img.shields.io/badge/Production-Live-success?style=for-the-badge&logo=vercel)](https://be-big-2-0.vercel.app)
[![Version](https://img.shields.io/badge/Version-v2.1.0-blue?style=for-the-badge)](https://github.com/Aditya5576/BeBig-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Expo](https://img.shields.io/badge/Expo-SDK_57-000020?style=for-the-badge&logo=expo)](https://expo.dev/)

---

## 🌐 Production Deployment

- **Live Production URL**: [https://be-big-2-0.vercel.app](https://be-big-2-0.vercel.app)
- **Deployment Platform**: Vercel (Edge-cached Progressive Web App)

> **Important**: Always use `https://be-big-2-0.vercel.app`. Do not use `https://bebig.vercel.app` (an unassociated legacy domain).

---

## 🚀 Latest Release — v2.1.0

### What's New in v2.1.0
- **Workout 2.0 Experience**: Athletic, spacious active workout UI with compact set rows, streamlined input UX, and professional proportions.
- **Multi-Select Exercise Picker**: Batch exercise selection with instant counter and addition.
- **Smart Exercise Reordering**: Smooth up/down reordering with auto-scroll compensation keeping moved exercises in view.
- **Redesigned Start Workout**: Modernized workout launcher integrated with Templates 2.0.
- **Balanced Rest Timer**: Compact, non-intrusive floating overlay with intuitive extend/skip controls.
- **New Premium Home Dashboard**: Streamlined personal training dashboard with focused hierarchy.
- **Cleaner Personal Progress**: Compact metrics for PRs, monthly workouts, streaks, and volume.

---

## 🚀 Previous Release — v1.0.5

### What's New in v1.0.5
- **Release Notes Popup Startup Timing Hotfix**: Defer "What's New" release notes modal dialog rendering until the authoritative 5-second BeBig startup splash gatekeeper completes and transitions to the main app interface.
- **Flawless Transition & Zero Flash**: Eliminates any visual flash or behind-splash modal rendering on app launch.
- **Versioned Acknowledgement Preserved**: Preserved local version acknowledgement lifecycle (`releaseNotesService`) ensuring updates are presented once per version.
- **Rest Timer UI Polish & Responsive Alignment**: Enhanced rest timer controls with symmetric button placement, centered timer countdown, and fluid spacing adapted for all screen widths and device aspect ratios.
- **Improved Timer Controls & Edge Spacing**: Prevented touch target clipping on curved mobile screens and high-density displays; polished increment/decrement controls (`+30s` / `-30s`).
- **Versioned "What's New" Release Modal**: Built-in interactive release modal (`ReleaseNotesModal`) automatically highlighting key updates and features upon app startup.
- **Local Release Acknowledgement**: Version-specific acknowledgement persistence (`releaseNotesService`) ensuring users view updates once per release without recurring dialog interruptions.
- **WGER Exercise Library Connectivity**: Allowed external exercise provider domains through production Content Security Policy (CSP) for uninterrupted asset resolution.
- **Native Status & Theme Consistency**: Unified dark mode status bar styling and native safe area insets.

---

## ✨ Key Features & Capabilities

### 1. Workout Tracking & Live Logging
- **Real-Time Set Logging**: Track weight, reps, RPE (Rate of Perceived Exertion) / RIR (Reps in Reserve), set completion checks, and per-set notes.
- **Dynamic Set & Exercise Management**: Add, duplicate, delete, and reorder exercises and sets on the fly.
- **Auto-Calculated Volume & Tonnage**: Real-time aggregation of session volume, completed sets, and active workout duration.
- **Authoritative Isolated Timer (PERF-1)**: Elapsed workout timer decoupled from the active workout tree, maintaining a 1-second cadence without re-rendering active exercise inputs or cards.
- **Storage Write Debouncing (PERF-2)**: High-speed typing into weight/rep fields updates in-memory React state instantly, with local storage writes debounced by 300ms.
- **Guaranteed Flush Semantics**: Critical lifecycle events (set completion toggling, set additions, workout finish/discard, and app backgrounding) bypass debounce and flush immediately to durable storage.

### 2. Intelligent Rest Timer
- **Automatic Countdown Triggering**: Starts immediately when a set is checked off, keeping lifters focused and on schedule.
- **Interactive Controls**: Dedicated rest timer overlay and compact floating banner with quick adjustments (`+30s`, `-30s`, skip, pause, resume).
- **Audio & Haptic Alerts**: Sound and vibration notifications upon timer expiration for hands-free training.

### 3. Exercise Library & Custom Exercises
- **Extensive Exercise Catalog**: Curated directory organized by muscle group (Chest, Back, Legs, Shoulders, Arms, Core, Full Body) and equipment type.
- **WGER & External Provider Ingestion**: Decoupled integration layer caching standard exercise definitions with media assets.
- **Custom Exercise Builder**: Lifters can create, edit, categorize, and delete custom exercises with custom instructions and target muscle groups.
- **Instant Client-Side Filtering**: High-speed search with instant category chips (`All`, `Custom`, `WGER`).

### 4. Reusable Workout Templates
- **Template Creator & Editor**: Build reusable workout splits (Push/Pull/Legs, Upper/Lower, Full Body) with preset exercises, target sets, and target reps.
- **Quick-Start Sessions**: Launch an empty workout or start directly from any saved template with a single tap.
- **Template Reordering**: Customize exercise sequence within templates for streamlined execution.

### 5. Scheduling & Calendar Planner
- **Interactive Workout Calendar**: Plan workouts on a weekly schedule.
- **Scheduled Session Linkage**: Start scheduled workouts directly from the calendar, automatically linking completion records back to the scheduled routine.

### 6. Analytics & Personal Records (PRs)
- **Automatic PR Tracking**: Detects and highlights personal records for 1RM estimations, highest weight lifted, and single-session tonnage.
- **Volume & Frequency Progression**: Historical graphs and metrics showing weekly volume, set consistency, and workout duration.
- **Muscle Distribution**: Visual breakdown of targeted muscle groups to detect training imbalances.

### 7. Workout History & Log Inspection
- **Chronological History Feed**: Detailed cards summarizing completed workouts with duration, total volume (kg/lbs), completed sets, and exercise breakdown.
- **Detailed Session Review**: Inspect historical sets, weights, reps, and workout notes anytime.

### 8. Local-First & Offline Architecture
- **Complete Offline Independence**: Log entire workouts in gyms with zero cellular reception or Wi-Fi without degradation.
- **Crash-Resilient Session Recovery**: Active workout sessions are continuously persisted to local storage; reopening the app after process termination immediately resumes the active session.
- **Differential Sync Outbox**: Mutations are staged locally in a sync queue and pushed to Supabase PostgreSQL once network connectivity is restored.
- **Tombstone Deletion & Conflict Resolution**: Clean data synchronization across multiple devices without data loss.
- **Live Sync Status Indicators**: Header status badge reflecting real-time sync states (`synced`, `syncing`, `offline`, `error`).

### 9. Authentication & Frictionless Guest Mode
- **Guest-First Experience**: Lifters can jump directly into logging workouts without creating an account.
- **Seamless Account Migration**: Upgrading from guest mode to an authenticated account automatically merges local workouts, history, templates, and PRs.
- **Secure Authentication**: Supabase Auth supporting Email/Password and native Apple Sign-In on iOS, protected by hardware-backed SecureStore.

### 10. Progressive Web App (PWA) & Web Support
- **Cross-Platform Parity**: Runs smoothly on mobile browsers and desktop displays with responsive touch controls and accessible keyboard navigation.
- **Installable PWA**: Configured with web application manifest, icons, and standalone display support for a native-like experience.

---

## 📸 Screenshots & UI Surfaces

<p align="center">
  <img src="assets/bebig-emblem.png" alt="BeBig 2.0 Emblem" width="160" />
</p>

The BeBig 2.0 interface is crafted with a high-contrast athletic dark theme (`#0D0D12` / `#16161F` / `#00E599` accent) optimized for gym environments:

| Screen / Feature | Description | Status |
| :--- | :--- | :---: |
| **Onboarding** | Multi-step lifter profiling (experience level, goals, equipment) | ✅ Live |
| **Home Dashboard** | Quick start, scheduled routines, recent workouts, and sync status | ✅ Live |
| **Active Workout** | Live tracker with set logging, weight/reps, RPE, and elapsed timer | ✅ Live |
| **Rest Timer** | Centered countdown, quick `+30s` / `-30s` adjustments, and audio cues | ✅ Live (Polished in v1.0.4) |
| **Exercise Library** | Muscle-based filtering, instant search, and custom exercise creation | ✅ Live |
| **Exercise Details** | Target muscle breakdown, equipment specs, and execution instructions | ✅ Live |
| **Templates** | Routine designer for Push/Pull/Legs and custom training splits | ✅ Live |
| **Calendar / Planner** | Weekly workout scheduler with one-tap start linkage | ✅ Live |
| **Workout History** | Chronological log of past sessions, tonnage volume, and duration | ✅ Live |
| **Analytics & PRs** | Personal records, tonnage progression, and muscle group distribution | ✅ Live |
| **What's New Modal** | In-app versioned release notes with local acknowledgement | ✅ Live (Added in v1.0.4) |

> *Note: Production device snapshots from physical gym validation cycles are updated directly from validated mobile devices to maintain authentic representation.*

---

## 🛠 Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | [React Native 0.86](https://reactnative.dev/) with [Expo SDK 57](https://expo.dev/) |
| **Routing** | [Expo Router ~57.0](https://docs.expo.dev/router/introduction/) (File-based navigation) |
| **Language** | [TypeScript 6.0](https://www.typescriptlang.org/) (Strict Mode) |
| **State Management** | [Zustand 5.0](https://github.com/pmndrs/zustand) |
| **Backend & Database** | [Supabase](https://supabase.com/) (PostgreSQL with Row Level Security) |
| **Local Persistence** | Durable Storage Adapter (SQLite / Expo SecureStore / LocalStorage) |
| **Web & PWA** | React Native Web (`react-native-web`) with PWA Manifest |
| **Testing** | [Jest 29](https://jestjs.io/) & [React Native Testing Library 14](https://callstack.github.io/react-native-testing-library/) |
| **Monitoring** | [Sentry](https://sentry.io/) (Client & Edge error tracking) |
| **Deployment** | [Vercel](https://vercel.com/) (Edge PWA Hosting) |

---

## 🏗 Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                   BeBig Client (React Native / PWA)              │
│                                                                  │
│  [Expo Router Navigation]  ──►  [Dark Theme Tokens & UI Primitives]│
│            │                                    │                │
│            ▼                                    ▼                │
│  [Feature Modules: Workouts, Exercises, History, Templates, PRs] │
│            │                                                     │
│            ▼                                                     │
│  [Zustand Stores & Local-First Storage Cache]                    │
│            │                                                     │
│            ▼                                                     │
│  [Sync Outbox & Supabase Data Service Adapter]                   │
└───────────────────────────────┬──────────────────────────────────┘
                                │ HTTPS / WSS
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                 Supabase Cloud & Data Services                   │
│                                                                  │
│  - Supabase PostgreSQL (Row Level Security enabled)              │
│  - Supabase Authentication (JWT, Apple OAuth, Guest Migration)   │
│  - Normalized Exercise Catalog & Third-party Ingestion           │
└──────────────────────────────────────────────────────────────────┘
```

### Directory Structure
```
BeBig 2.0/
├── app/                  # Expo Router file-based routes and screen layouts
│   ├── (tabs)/           # Core tab screens (Home, Exercises, Templates, History, Profile)
│   ├── workout/          # Active workout execution & finish workflows
│   ├── exercise/         # Exercise details and custom exercise builder
│   └── _layout.tsx       # Root provider layout, theme setup, & release modal
├── assets/               # Branding emblems, splash screens, and application icons
├── public/               # PWA icons, manifest.json, and web assets
├── src/
│   ├── components/       # Design system primitives (Button, Text, Card, Modals)
│   ├── constants/        # Design tokens (Colors, Spacing, Typography)
│   ├── features/         # Domain-isolated modules (workouts, exercises, auth, analytics)
│   ├── lib/              # Integrations & utilities (storage, releaseNotes, sync)
│   ├── services/         # Supabase client and external provider adapters
│   ├── store/            # Zustand global state slices
│   └── types/            # Shared TypeScript type definitions
└── tests/                # Automated unit & integration tests
```

---

## 💻 Getting Started / Development

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.x or later)
- [npm](https://www.npmjs.com/) or [bun](https://bun.sh/)
- [Expo Go](https://expo.dev/go) app on your mobile device (optional, for physical device preview)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/Aditya5576/BeBig-2.0.git
   cd "BeBig 2.0"
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env.local
   ```
   Configure your Supabase credentials:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

### Development Commands
```bash
# Start local development server
npm run web           # Run in web browser
npm run ios           # Run on iOS simulator
npm run android       # Run on Android emulator

# Quality & Validation
npm run typecheck     # TypeScript strict type checking
npm run lint          # ESLint inspection
npm test              # Run automated Jest test suite
npm run build:web     # Export static production web bundle
```

---

## 🚢 Production & Deployment

- **Hosting**: Deployed automatically on [Vercel](https://vercel.com/) via GitHub integration on `main`.
- **Web Export**: Handled via `npm run build:web` with automatic commit SHA stamping (`EXPO_PUBLIC_GIT_SHA=${VERCEL_GIT_COMMIT_SHA}`).
- **Security Headers**: Production Content Security Policy (CSP), permissions policies, and cache-control headers are defined in `vercel.json`.

---

## 📄 License

Proprietary — All rights reserved. Built with pride for serious lifters.
