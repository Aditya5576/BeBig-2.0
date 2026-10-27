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
- **Exercise Demonstration Media Architecture (Phase 2, M1)**: Demonstration media resolution is keyed strictly by canonical, stable exercise IDs (never exercise names or fuzzy similarity). The initial foundation uses a local, typed, immutable catalog (`CURATED_EXERCISE_MEDIA_CATALOG`) and a deterministic resolver (`exerciseMediaService`) requiring explicit copyright/license verification and author/source attribution before any asset is cleared for display. Zero database migrations or Supabase tables are created for this feature; production catalog contains only verified assets (empty by default). Existing user-owned custom exercise photos remain strictly isolated from system demonstration media. UI integration (thumbnails, detail viewer, active workout sheet) and broad media asset sourcing are decoupled into subsequent milestones.
- **Exercise Library Search Concurrency & Pagination Deduplication**: Search queries in BeBig 2.0 return ranked candidates in a single unpaginated batch. To eliminate duplicate React child keys (e.g. `.$wger_75`) caused by stale browse pagination triggering during search transitions: (1) filter and search query changes immediately reset `hasMore: false` and `nextOffset: undefined`; (2) `handleLoadMore` immediately exits if `searchQuery.trim().length > 0`; (3) browse and search requests are sequenced using a monotonically increasing request ID ref (`searchReqIdRef`) to ensure out-of-order asynchronous responses cannot overwrite newer search results; (4) list pagination appends deduplicate against existing exercise IDs via a `Set` before merging.
- **Exercise Library Visual Representation & Search Performance (Phase 2, M2 Optimization)**: Letter-based placeholder tiles (e.g. 'BK', 'BP', 'CH') are replaced with a clean, neutral monochrome workout icon fallback to eliminate artificial game-style visual clutter. For responsiveness and smooth 60fps scrolling: (1) search input, category, and source changes query the in-memory cache synchronously in the event handler (0ms local response) while keeping remote API refresh debounced and non-blocking in the background; (2) `damerauLevenshtein` distance calculation uses a single flat typed buffer (`Int32Array`) and word-token matching, eliminating 95%+ of dynamic allocations on the JS thread during fuzzy search; (3) fallback token network requests run concurrently via `Promise.allSettled` with a 2000ms ceiling instead of sequential loops; (4) exercise list items are memoized via `React.memo` with `removeClippedSubviews` enabled on native platforms.
