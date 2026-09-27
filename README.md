# BeBig 2.0 🏋️‍♂️

A production-ready public gym workout tracker built with Expo, React Native, TypeScript, Supabase, and local-first offline architecture.

## Production

Production app:
https://be-big-2-0.vercel.app

> **Note**: Do not use `https://bebig.vercel.app` as the production link. That domain belongs to another account and is not the working production alias.

---

## Current Features

- **Onboarding**: Comprehensive multi-step onboarding tailored for beginner, intermediate, and advanced lifters.
- **Authentication**: Email/password authentication, Apple Sign-In on iOS, secure hardware session storage, and persistent profile state.
- **Guest Mode**: Full workout tracking experience without an account, with seamless migration when authenticating.
- **Workout Execution**: Live workout tracker with set logging, automated rest timer countdowns, continuous autosave, and exercise reordering.
- **Templates**: Full template management with creation, editing, scheduling, and starting empty or template-based workouts.
- **Workout History**: Detailed log of past workouts, tonnage volume calculations, duration tracking, and workout inspection.
- **Analytics & PR Tracking**: Automatic personal record (PR) tracking, volume analytics, frequency charts, and progress curves.
- **Scheduling & Calendar**: Weekly calendar planner for scheduled sessions with one-tap start and auto-completion linkage.
- **Offline / Local-First Workout Recovery**: Fully offline capable with crash-safe recovery, durable SQLite/SecureStore persistence, and automatic session restoration.
- **Cloud Sync & Status Indicators**: Differential sync with Supabase, sync outbox, conflict resolution, tombstone deletion, and live sync status chips (`synced`, `syncing`, `offline`, `error`).
- **Exercise Library**: Rich catalog of exercises with WGER/external provider integration, muscle grouping, and category filtering.
- **Custom Exercises**: User-defined custom exercise creation, editing, notes, deletion, and immediate selection across active workouts and templates.
- **Search & Filtering UX**: High-performance client-side search, instant filtering by category and source (`All`, `Custom`, `WGER`), and smooth selection flows.
- **PWA & Web Support**: Progressive Web App capabilities, responsive layouts, web alert modals, and keyboard accessibility.
- **Sentry Monitoring**: Integrated client and server error reporting with breadcrumbs and release tracking.
- **Performance Optimizations (PERF-1 & PERF-2)**: High-speed rendering and reduced storage I/O during heavy workout sessions.

---

## Current Production Release

- **Version**: `v1.0.1`
- **Release Scope**:
  - Exercise Library milestone completion (EXERCISE-1 through EXERCISE-5)
  - PERF-1: Active Workout Timer Isolation
  - PERF-2: Active Workout Storage Write Debouncing

---

## Performance Improvements

- **Isolated Elapsed Workout Timer (PERF-1)**: The 1-second workout timer tick is decoupled from the active workout component tree into an isolated `ActiveWorkoutTimer` component. It renders authoritative elapsed time from `startedAt` and `accumulatedPauseSeconds` without triggering re-renders across exercise cards, set rows, or inputs.
- **Storage Write Debouncing (PERF-2)**: High-frequency user typing into Weight, Reps, RIR, and Notes updates in-memory React state immediately for instantaneous responsiveness, while disk persistence (`workoutRepository.updateActiveWorkout`) is debounced with a 300ms trailing delay.
- **Guaranteed Flush Semantics**: Critical workout actions (set completion toggle, adding/removing/reordering sets and exercises, finishing, discarding, pausing, backgrounding via `AppState`, and component unmount) bypass debounce and immediately flush pending in-memory state to disk to prevent data loss.

---

## Screenshots

Production screenshots will be added after the next physical gym validation session.

---

## Development Resume Point

- **Production Release**: `v1.0.1`
- **Release Commit**: Pending commit
- **Production Deployment**: Pending deployment
- **Last Completed Work**: PERF-2 — Active Workout Storage Write Debouncing
- **Completed Before Release**:
  - Exercise Library Milestone
  - PERF-1 — Active Workout Timer Isolation
  - PERF-2 — Active Workout Storage Write Debouncing
- **Next Task**: PERF-3 — Active Workout Last Performance Single-Pass Lookup
- **Not Started**:
  - PERF-3
  - PERF-4
  - Final Performance Audit
- **Tomorrow's Task**: Full end-to-end physical gym validation on production.

---

## Tech Stack

- **Framework**: [React Native](https://reactnative.dev/) with [Expo](https://expo.dev/) (SDK 57)
- **Routing**: [Expo Router](https://docs.expo.dev/router/introduction/) (File-based navigation)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict Mode)
- **Backend / DB**: [Supabase](https://supabase.com/) (PostgreSQL, Row Level Security, Storage)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Design System**: High-contrast athletic dark theme design tokens & UI primitives
- **Testing**: [Jest](https://jestjs.io/) & [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- **Monitoring**: [Sentry](https://sentry.io/)
