# AGENT ENTRYPOINT

This repository uses the Antigravity Token-Saving Brain.

Before making changes:
1. Read AI_RULES.md
2. Read AI_BRAIN.md
3. Consult PROJECT_INDEX.md only as needed
4. Search before reading
5. Verify after changing

See ANTIGRAVITY_MASTER_PROMPT.txt for the complete operating policy.
Do not treat AI memory as source code. Actual project files are authoritative.

## Project Guidelines
- Run tests and verifications with the main agent; use subagents only when genuinely necessary and justified.
- Default to Gemini Flash for routine implementation.
- Escalate to Gemini Pro or Claude Sonnet/Opus only when explicitly needed for architecture or complex reasoning.
- All agents must respect AI_RULES.md and this token-saving system.

## Verified Skill Workflow
When a task matches an installed engineering skill (located in `C:\Users\adity\.agents\skills\`):
1. **Task-Specific Selection**: Select only the skill relevant to the task (never load all five):
   - `gravitas`: Complex implementations, multi-file changes, architectural refactoring, or contract-gated verification.
   - `systematic-debugging`: Diagnosing test failures, bugs, unexpected runtime behavior, or regressions.
   - `test-driven-development`: Authoring new features or reproducing bugs via failing tests first.
   - `code-review-excellence`: Reviewing PRs, git diffs, architectural changes, or code quality.
   - `git-commit-message`: Formatting commit messages from staged diffs (`git status`, `git diff --cached`).
2. **Read Before Use**: If the selected skill is not already mounted in `<skills>`, read its `SKILL.md` before applying its procedures.
3. **Truthful Reporting Standards**:
   - Clearly distinguish skills automatically discovered, manually read, and practices actually applied.
   - Never claim full compliance or automatic discovery merely because a file was read.
   - In the completion report, cite the skill name and the concrete practices executed with observable evidence.
4. **Safety Boundaries**:
   - Run focused tests and typechecks before concluding a task; prefer the main agent.
   - Preserve uncommitted work and existing project patterns.
   - Require explicit user approval before git push, branch merge, or production deployment.
