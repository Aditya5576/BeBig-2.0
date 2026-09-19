# AI Context Policy

This policy governs context loading, file reading, and exploration limits.

**Authoritative Rules**: See [AI_RULES.md](file:///c:/Users/adity/Desktop/ADI/BeBig%202.0/AI_RULES.md)
- **RULE 1 (Search Before Read)**: Identify likely symbols/files and search before reading.
- **RULE 2 (Never Scan Everything)**: Exclude `node_modules`, `.git`, build outputs, and caches by default.
- **RULE 5 (Minimum Sufficient Context)**: Stop reading once enough evidence exists to execute correctly.
