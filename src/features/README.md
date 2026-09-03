# Feature Modules (`src/features/`)

BeBig follows a **feature-first** modular architecture. Each domain area is isolated inside its own folder under `src/features/`.

## Target Feature Structure (Milestones 2+)

Planned feature directories:

- `auth/` — Authentication flows (Google, Apple, Email), session management
- `exercises/` — Exercise catalog, search, muscle group filters, detail views
- `workouts/` — Active workout tracker, set logger, rest timer
- `templates/` — Routine templates, split creator, program builder
- `history/` — Past workout logs, volume summaries, workout details
- `analytics/` — Strength progress charts, 1RM estimations, muscle distribution
- `profile/` — User preferences, measurement units (kg/lbs), cloud sync status

## Feature Folder Conventions

When creating a feature folder, follow this standard pattern:

```
src/features/[feature-name]/
├── components/     # Feature-specific UI components
├── hooks/          # Feature-specific custom hooks
├── services/       # Feature-specific API calls & data transformations
├── store/          # Feature-specific Zustand store (if applicable)
├── types/          # Feature-specific domain types
└── index.ts        # Public API surface exported by the feature
```

## Boundary Rules

1. Features should communicate through public exports (`index.ts`).
2. Do not cross-import private implementation details between features.
3. Common UI components live in `src/components/`, not duplicated across features.
