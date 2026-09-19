# Architectural Decisions
- Wger integration uses client-side `WgerExerciseProvider` with local `exerciseCacheStorage` caching; edge function ingestion into Supabase is planned for future backend migration.
- Using Expo Router for all navigation.
- Animations require `Platform.OS !== 'web'` for native driver compatibility on the web splash screen.
