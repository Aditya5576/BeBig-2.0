# BeBig 2.0 Skill Registry & Provenance

This registry governs all repo-local AI skills in `.agents/skills/` and references user-global engineering skills in `C:\Users\adity\.agents\skills\`.

## Repo-Local Upstream Skills (4)

| Skill | Source | Commit SHA | License | Local Path | Load Trigger |
|---|---|---|---|---|---|
| `skill-scanner` | `https://github.com/getsentry/skills.git` (`skills/skill-scanner`) | `a582c51ee29d0f35e6ac321340796f77d43da733` | Apache-2.0 | `.agents/skills/skill-scanner/SKILL.md` | Auditing or onboarding third-party AI skills |
| `supabase` | `https://github.com/supabase/agent-skills.git` (`skills/supabase`) | `c9be0e931b7930f7d02126d04774d904c381e7d7` | MIT | `.agents/skills/supabase/SKILL.md` | Supabase CLI, Edge Functions, Auth, Storage |
| `supabase-postgres-best-practices` | `https://github.com/supabase/agent-skills.git` (`skills/supabase-postgres-best-practices`) | `c9be0e931b7930f7d02126d04774d904c381e7d7` | MIT | `.agents/skills/supabase-postgres-best-practices/SKILL.md` | Postgres schema, indexing, RLS, query tuning |
| `react-native-best-practices` | `https://github.com/callstackincubator/agent-skills.git` (`skills/react-native-best-practices`) | `59e9d17446a248b21d86f078fcd0bd2d36db1ca4` | MIT | `.agents/skills/react-native-best-practices/SKILL.md` | React Native performance, lists, native/JS bridge |

## Repo-Local Custom BeBig Skills (4)

| Skill | Source | Commit SHA | License | Local Path | Load Trigger |
|---|---|---|---|---|---|
| `bebig-offline-sync-engine` | BeBig 2.0 (internal) | Local | Repo-local | `.agents/skills/bebig-offline-sync-engine/SKILL.md` | Workout storage, IndexedDB/SecureStore, CAS, sync engine |
| `bebig-webkit-memory-safety` | BeBig 2.0 (internal) | Local | Repo-local | `.agents/skills/bebig-webkit-memory-safety/SKILL.md` | iOS Safari/PWA lifecycle, pickers, images, listeners |
| `bebig-backend-security` | BeBig 2.0 (internal) | Local | Repo-local | `.agents/skills/bebig-backend-security/SKILL.md` | RLS policies, Deno Edge Functions, storage auth, PII |
| `bebig-obsidian-design-system` | BeBig 2.0 (internal) | Local | Repo-local | `.agents/skills/bebig-obsidian-design-system/SKILL.md` | Theme tokens, RN UI, safe areas, VoiceOver |

## User-Global Engineering Skills (`C:\Users\adity\.agents\skills\`)

- `token-saving`, `gravitas`, `gravitas-reliability`, `systematic-debugging`, `test-driven-development`, `vitest-tdd-workflow`, `code-review-excellence`, `git-commit-message`, `react-best-practices`, `typescript-expert`, `pwa-offline-indexeddb`, `healthcare-security-privacy`.

## Governance Rules

1. Load only the task-relevant skill(s); never bulk-load unrelated skills.
2. All upstream skills must include `UPSTREAM.txt` (Source, Commit, Path) and `UPSTREAM-LICENSE`, and pass static security screening before use.
3. Never execute unvetted bundled scripts from upstream skills without explicit user review.
