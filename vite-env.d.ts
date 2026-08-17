/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_CLERK_PUBLISHABLE_KEY: string
    readonly VITE_SUPABASE_URL: string
    readonly VITE_SUPABASE_ANON_KEY: string
    readonly VITE_INTENT_ENGINE_ENABLED?: string
    readonly VITE_CONVERSATION_MEMORY_ENABLED?: string
    readonly VITE_ADAPTIVE_PROBING_ENABLED?: string
    readonly VITE_BACKGROUND_ENRICHMENT_ENABLED?: string
    readonly VITE_NEW_REPORTS_ENABLED?: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}

declare module 'shepherd.js';
