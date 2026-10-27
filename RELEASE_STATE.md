# BeBig 2.0 — Release State

## Production (Live Verified)
- **URL**: https://be-big-2-0.vercel.app
- **Configured Version**: v2.1.1 (`package.json`, `app.json`)
- **Verified Production Commit**: `b511ab6b2158c3c57bde95904b1765868d5b3958` (Merge PR #5)
- **Deployment Status**: Ready (Verified on live Vercel bundle 2026-10-15)
- **Deployment Method**: Automatic Vercel deployment on `main` branch push

## Deployed Features in Production (v2.1.1 · b511ab6)
- **Task 1**: Automatic workout-template session numbering (`Session #1`, `Session #2`)
- **Task 2**: Profile photo upload, cropping, and cross-platform persistence
- **Task 3**: Recently used exercises in the exercise picker
- **Task 4**: Genuine Excel (.xlsx) and PDF (.pdf) export for history and templates
- **Task 5**: Progress Analytics 2.0, weekly performance trends, & AI Weekly Analysis
- **Task 6**: iOS and Android workout/rest-timer background notifications
- **PR #5 Hotfix**: Profile black screen fix (deferred heavy export imports), PDF WinAnsi Unicode fix (U+202F), and iOS `timeSensitive` notification registration
- **Prior Foundation**: Workout 2.0 athlete experience, Rest Timer UI polish, Exercise Library, CSP configuration

## Development Status (Pending / Local Work)
- **Current Working Branch**: `feat/m1-remove-scheduled-workouts`
- **Current HEAD**: `b511ab6b2158c3c57bde95904b1765868d5b3958`
- **Pending Uncommitted Milestones**:
  - **M1 (Removal)**: Safely remove scheduled workouts (local verification complete, uncommitted)
  - **M3 (Optimization)**: Bounded AI Coach history query & lifetime volume preservation (local verification complete, uncommitted)
  - **What's New Popup**: Version-aware release notes modal with onboarding protection (local verification complete, uncommitted)
  - **M4 (Audit)**: Avatar storage privacy audit & path sanitization (local verification complete, uncommitted)
- **M2 Milestone**: Workout/rest-timer notifications audit (explicitly deferred)

## Release Rule
1. Test production end-to-end on physical device during gym usage.
2. Record any production issues.
3. Fix production issues if discovered.

> **Important**: Do not delete or overwrite this state file during normal development.
