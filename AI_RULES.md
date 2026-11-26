# AI RULES — Token-Efficient Engineering

## PRIME DIRECTIVE
Produce correct changes with the minimum necessary context under strict token mode:
- **Max 25-Line Reads:** Never read full files; run `rg -n` (or `Select-String`) first, then read only 15–25 lines around the match. Never re-read a file already read/edited in the session.
- **Batch All Edits First:** Apply all planned file edits before running `tsc`, `lint`, or `jest`—never run checks mid-way between edits.
- **One Combined Shell Gate:** Run `npm run typecheck && npx eslint app src --no-cache && npx jest <targeted-suites> --maxWorkers=2` as ONE single command at the end (use `npx eslint app src --no-cache` instead of `npm run lint -- --no-cache`).
- **Zero Narration & Terse Output:** Output zero status messages between tool calls. Final report must be <= 8 bullet lines with no code blocks.
- **Single Agent & Fresh Chat:** Never spawn subagents; use one fresh chat per task.
- **Protected Boundaries:** Never modify `app/+html.tsx`, `src/features/workout/services/workoutNotificationService.ts`, `supabase/functions/coach-agent/`, `app/coach/`, `src/features/coach/`, `supabase/functions/coach-v2/`, or untracked `unwanted files-code.md`.

## 1. CONTEXT LOADING
Before coding:
1. Read AI_BRAIN.md.
2. Read only the task-relevant section of PROJECT_INDEX.md.
3. Search for the exact symbol, route, component, function, table, API, or error.
4. Read the smallest set of source files needed.
5. Expand context only when evidence requires it.

NEVER start by dumping or reading the entire repository.

## 2. NEVER WASTE CONTEXT ON
Unless directly required:
- node_modules/
- .git/
- dist/
- build/
- coverage/
- generated files
- caches
- binaries
- lockfiles
- screenshots/assets unrelated to the task
- vendor/third-party source
- unrelated feature folders

## 3. SOURCE OF TRUTH
Priority:
1. Actual source/configuration/runtime evidence
2. Tests and observed behavior
3. AI_BRAIN.md / project documentation
4. Previous AI assumptions

If memory conflicts with source code, source code wins. Update memory after the change.

## 4. TASK SIZING
Classify every task:
- TINY: one obvious file/change
- SMALL: one feature or a few files
- MEDIUM: multiple related modules
- LARGE: architecture, migrations, major refactor

For TINY/SMALL tasks, do not perform broad repository exploration.

## 5. SEARCH BEFORE READ
Prefer targeted search:
- exact filename
- exact function/component
- route
- error text
- database table/column
- import/reference
- configuration key

Do not read files merely because they exist.

## 6. EDIT DISCIPLINE
Before editing, state internally:
- what is broken/requested
- which files are likely involved
- what evidence supports that
- smallest safe change

Avoid unrelated refactors.

## 7. VERIFY, DON'T GUESS
After changes, run the cheapest meaningful verification:
- typecheck
- lint
- unit test
- targeted test
- build/export
- runtime/browser verification

Use the smallest verification that can actually catch the regression.

## 8. ERROR LOOP PROTECTION
If the same failure occurs twice:
- stop repeating the same fix
- inspect the actual error and surrounding code
- identify a new hypothesis
- test that hypothesis

Never perform blind edit → retry loops.

## 9. SCOPE CONTROL
Do not fix unrelated issues discovered during a task unless:
- they block the requested work, or
- they create a clear correctness/security problem.

Mention unrelated findings separately.

## 10. MEMORY HYGIENE
AI memory must remain compressed.
- Record decisions, architecture, constraints, and current blockers.
- Do not record every edit.
- Do not duplicate source code.
- Remove obsolete information.
- Prefer one precise bullet over paragraphs.

## 11. COMPLETION STANDARD
A task is complete only when:
- requested behavior is implemented
- relevant verification passes
- no known regression from the change
- memory is updated if architecture/state changed
- final response is concise and reports what changed + verification
