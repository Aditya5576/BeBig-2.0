# Services (`src/services/`)

This directory encapsulates all external communication and backend integrations.

## Architectural Mandates

1. **Decoupled External Providers**: The mobile client must never communicate directly with raw third-party APIs (e.g. Wger). Instead, third-party data is ingested by the BeBig backend and normalized into BeBig domain models before delivery to the client.
2. **Backend Gateway**: In future milestones, services here will interact with Supabase (via public client using Row Level Security) and BeBig serverless API endpoints.
3. **No Direct Secret Access**: Service calls must use client-safe tokens (`EXPO_PUBLIC_SUPABASE_ANON_KEY`, session JWTs). Never embed admin/service-role credentials.
