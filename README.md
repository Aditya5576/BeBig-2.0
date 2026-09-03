# BeBig 2.0 🏋️‍♂️

A production-quality public mobile workout and fitness tracking application, built with React Native and Expo.

## Tech Stack (Milestone 1 Foundation)

- **Framework**: [React Native](https://reactnative.dev/) with [Expo](https://expo.dev/) (SDK 57)
- **Routing**: [Expo Router](https://docs.expo.dev/router/introduction/) (File-based navigation)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict Mode)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Design System**: Custom design tokens & UI primitives (high-contrast athletic dark theme)
- **Testing**: [Jest](https://jestjs.io/) & [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- **Code Quality**: ESLint 9 + Prettier

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — Product vision, platform priority, decoupling Wger, and future cloud/auth plans.
- [DEVELOPMENT_RULES.md](./DEVELOPMENT_RULES.md) — 15 mandatory engineering rules for all contributors and agents.

## Getting Started

### Prerequisites

- Node.js >= 20
- npm >= 10
- Expo Go app on your physical iOS/Android device OR Xcode / Android Studio simulators

### Installation

```bash
npm install
```

### Running Locally

```bash
# Start Expo development server
npm start

# Run on iOS Simulator (macOS required)
npm run ios

# Run on Android Emulator / Device
npm run android

# Run Web Preview
npm run web
```

### Verification & Quality Scripts

```bash
# Run TypeScript type check
npm run typecheck

# Run ESLint check
npm run lint

# Check code formatting
npm run format

# Automatically format code
npm run format:fix

# Run automated tests
npm test
```

## Milestone Roadmap

- [x] **Milestone 1: Foundation Setup** (Architecture, directory structure, environment rules, tooling, tests, UI tokens)
- [ ] **Milestone 2: Design System & Core Navigation Shell**
- [ ] **Milestone 3: Authentication & User Profiles**
- [ ] **Milestone 4: Exercise Catalog & Ingestion Layer**
- [ ] **Milestone 5: Workout Tracker & Set Logger**
- [ ] **Milestone 6: History, Analytics & Offline Sync**
