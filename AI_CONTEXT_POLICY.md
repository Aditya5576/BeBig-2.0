# AI CONTEXT POLICY

## Progressive Disclosure Model

Use context in layers:

### Layer 0 — Always
- Current user request
- AI_RULES.md
- Relevant portion of AI_BRAIN.md

### Layer 1 — Navigation
- PROJECT_INDEX.md
- relevant DECISIONS.md entries
- relevant KNOWN_ISSUES.md entries

### Layer 2 — Evidence
- exact source files
- tests
- configuration
- schema
- error logs

### Layer 3 — Expansion
Only when Layer 2 cannot answer the question:
- callers/dependents
- related modules
- integration points
- broader architecture

### Layer 4 — Repository-wide
Use only for:
- architecture migrations
- global renames
- security audits
- dependency upgrades
- cross-cutting bugs
- explicit repository-wide requests

## Context Budget Rules
Prefer:
- 1 exact search over 10 file reads
- 3 relevant files over 30 possible files
- targeted snippets over full files
- current source over stale memory
- fresh verification over speculation

When enough evidence exists, STOP READING and act.
