# BeBig 2.0 — Release State

## Production
- **URL**: https://be-big-2-0.vercel.app
- **Version**: v1.0.4
- **Production Commit**: Pending commit
- **Deployment**: Automatic Vercel deployment on main branch push

## Completed in v1.0.4
- Rest Timer UI polish and responsive alignment
- Improved timer controls and edge spacing
- Versioned What's New modal (`ReleaseNotesModal`)
- Release acknowledgement stored locally per version (`releaseNotesService`)
- Exercise Library milestone (EXERCISE-1 through EXERCISE-5)
- PERF-1 Timer Isolation
- PERF-2 Storage Write Debouncing
- CSP update for WGER exercise integration

## Release Rule
1. Test production end-to-end on physical device during gym usage.
2. Record any production issues.
3. Fix production issues if discovered.

> **Important**: Do not delete or overwrite this state file during normal development.
