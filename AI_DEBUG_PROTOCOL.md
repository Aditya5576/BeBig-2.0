# AI DEBUG PROTOCOL

## Evidence-First Debugging

1. Capture the exact error.
2. Locate the originating symbol/file.
3. Trace only the immediate call/data path.
4. Form one falsifiable hypothesis.
5. Make the smallest test/fix.
6. Verify.
7. If false, create a different hypothesis.

## Escalation
If unresolved after 2 distinct hypotheses:
- inspect adjacent callers/dependencies
- inspect configuration/environment
- inspect recent relevant changes
- inspect platform/version compatibility
- reproduce with a minimal case if practical

## Never
- randomly change multiple unrelated files
- repeatedly reinstall dependencies without evidence
- suppress an error just to make the build pass
- claim success without verification
