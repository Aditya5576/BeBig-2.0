# BeBig 2.0 — Engineering & Development Rules

These rules govern all engineering work on the **BeBig 2.0** mobile project across all milestones. Every engineer and AI agent working on this codebase must adhere to them strictly.

---

## 15 Mandatory Development Rules

1. **Work milestone-by-milestone**:
   Execute only the tasks specified in the active milestone. Do not begin work on subsequent milestones until the current milestone is reviewed, verified, and approved.

2. **Do not implement future milestones without explicit instruction**:
   Resist the urge to anticipate future needs by writing speculative code, fake stubs, or placeholder implementations for unrequested milestones.

3. **Do not introduce unnecessary dependencies**:
   Every new dependency must have a clear, justified purpose compatible with Expo SDK and React Native. Prefer native primitives, standard React hooks, and simple utilities over heavy external libraries.

4. **Do not rewrite working code without a reason**:
   Refactor only when necessary to fulfill explicit milestone requirements, fix bugs, or maintain structural clarity. Avoid churn and gratuitous stylistic rewrites.

5. **Do not claim a feature is complete without testing it**:
   Every feature must be verified against actual runtime behavior and automated tests before it is declared complete.

6. **Do not claim tests passed unless they were actually run**:
   Never assume or simulate passing test suites. Execute the test command, capture the real output, and report failures honestly.

7. **Never expose or commit secrets**:
   No API keys, Supabase service-role keys, private certificates, database credentials, or auth secrets may ever be committed to Git or embedded into the client bundle (`EXPO_PUBLIC_` exposes data publicly).

8. **Validate external API responses**:
   Always validate and sanitize network responses at the service boundary before passing data into state stores or UI components.

9. **Keep business logic separate from UI**:
   UI components (`src/components/`, `app/`) should focus on rendering and presentation. Business logic belongs in feature hooks, service boundaries, and state stores (`src/store/`).

10. **Keep platform-specific code isolated when necessary**:
    When platform divergence is required (e.g., iOS haptics vs Android vibrations, or platform-specific safe area nuances), isolate it behind clean utility functions (`src/utils/platform.ts`) or platform file extensions (`.ios.tsx`, `.android.tsx`).

11. **Prefer simple maintainable solutions over unnecessary abstraction**:
    Avoid premature optimization and over-engineered generic abstractions. Clear, readable, maintainable code is prioritized.

12. **Preserve iOS compatibility while maintaining Android compatibility**:
    Treat iOS/iPhone as the primary design and interaction target, but never break Android compatibility or introduce iOS-exclusive assumptions.

13. **Do not create fake production architecture merely to demonstrate a feature**:
    Do not construct mock backend servers, synthetic REST APIs, or pretend cloud services inside the client code. Build true foundational abstractions.

14. **Before changing architecture, explain why the change is necessary**:
    Any structural revision, directory relocation, or core architectural change must be justified in writing before implementation.

15. **At the end of every milestone, report exactly what was changed and what was actually verified**:
    Provide a structured summary of files created/modified, dependencies added, commands actually executed, test outputs, and unverified items.

---

## Mobile Engineering Standards

- **Safe Area Handling**: All top-level screens must utilize `SafeAreaView` or safe-area insets (`react-native-safe-area-context`) to support notches, Dynamic Islands, and Android navigation bars.
- **Apple Touch Target Minimums**: All interactive touch targets must meet Apple's Human Interface Guidelines of at least $44 \times 44$ pt.
- **TypeScript Strictness**: `strict: true` in `tsconfig.json`. No `any`, no unhandled nulls, and no untyped state hooks.
- **Testing Delegation**: When running automated tests, execute test suites cleanly and capture real output.
