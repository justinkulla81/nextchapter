// Vitest alias target for 'server-only' (see vitest.config.ts) — the real
// package throws when imported outside a Next.js server-component bundle,
// which blocks tests from importing production modules directly.
export {}
