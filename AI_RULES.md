# Token-Saving Brain v2 - Global Operating Rules

## RULE 1 - SEARCH BEFORE READ
Never start by dumping the repository.
1. understand the user request
2. classify task size
3. identify likely symbols/files
4. search for exact identifiers
5. read only relevant files
Use progressive disclosure.

## RULE 2 - NEVER SCAN EVERYTHING BY DEFAULT
Do NOT automatically inspect:
- node_modules
- .git
- build
- dist
- coverage
- generated files
- caches
- vendor code
- dependency source
- unrelated assets
- unrelated feature directories
Only inspect these when the task genuinely requires them.

## RULE 3 - SOURCE CODE WINS
Priority:
1. actual source/config/runtime evidence
2. tests and observed behavior
3. AI memory/documentation
4. previous assumptions
If AI_BRAIN conflicts with actual source code: SOURCE CODE WINS. Then update the relevant memory.

## RULE 4 - TASK SIZING
Classify every task internally:
- TINY: one obvious file/change.
- SMALL: one feature or a few related files.
- MEDIUM: multiple related modules.
- LARGE: architecture, migration, major refactor, cross-cutting change.
Do not use LARGE-task exploration for a TINY/SMALL task.

## RULE 5 - MINIMUM SUFFICIENT CONTEXT
The objective is: CORRECT CHANGE using MINIMUM NECESSARY CONTEXT.
Do not read additional files simply because they might be interesting.
When enough evidence exists: STOP READING and implement.

## RULE 6 - NO UNNECESSARY SUBAGENTS
Do not spawn multiple subagents for routine tasks.
Do not use subagents merely to:
- reread the same files
- repeat the same tests

## RULE 7 - TARGETED TESTING
Run only tests affected by the change.
If a component is isolated, run ONLY its specific test suite.
Never run the entire test suite during development unless checking for widespread regression at the end of a LARGE task.
When tests fail, DO NOT GUESS. Read the actual failure output, inspect the specific lines that failed, trace the logic, and fix the root cause.

## RULE 8 - DEBUGGING LOOP PROTECTION
If a test/run fails 3 times for the same reason:
STOP EDITING.
Re-read the error. Trace the types. Look at the actual evidence.

## RULE 9 - NO BLIND EDITING
Before modifying code, identify:
- what is requested/broken
- likely affected files
- evidence supporting that conclusion
- smallest safe change
Do not perform speculative refactors.

## RULE 10 - SCOPE CONTROL
Do not fix unrelated problems discovered during a task.
Only expand scope if the unrelated issue:
- blocks the requested task
OR
- creates a clear correctness/security problem.
Otherwise report it separately.
