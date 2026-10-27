# ARCHITECTURAL DECISIONS

Only record decisions that future AI sessions must understand.

## Template
### [YYYY-MM-DD] — [Decision]
- Decision:
- Why:
- Alternatives rejected:
- Consequence:
- Status: active

## Rules
- Never record trivial implementation choices.
- If a decision becomes obsolete, mark it superseded.
- Do not duplicate the entire architecture here.

## Active Decisions
- **Wger Integration**: Uses client-side `WgerExerciseProvider` with local `exerciseCacheStorage` caching; edge function ingestion into Supabase is planned for future backend migration.
- **Routing**: Using Expo Router for all navigation.
- **Web Splash Animation**: Animations require `Platform.OS !== 'web'` for native driver compatibility on the web splash screen.
- **Avatar Storage Privacy Model**: The `avatars` Supabase Storage bucket is intentionally configured with `public = true` to allow performant direct CDN rendering in React Native `<Image />` and Expo Image without signed-URL latency, token expiry, or complex cache invalidation. Security is enforced through multi-layer controls: (1) anonymous object/bucket listing via PostgREST SELECT is blocked by storage RLS, (2) object mutation and deletion are strictly isolated to authenticated owners via `(storage.foldername(name))[1] = auth.uid()::text`, and (3) `public.profiles` database records containing avatar URLs are protected by user-only SELECT RLS policies. Blind URL guessing is mitigated by cryptographically random 128-bit UUID folder paths combined with millisecond upload timestamps. Private storage with signed URLs was evaluated and rejected because it would break existing production photos and introduce unnecessary latency/offline complexity.
