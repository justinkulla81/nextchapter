import { APP_TOP_LEVEL } from '@/lib/app-top-level'

// A link cut off where an email or chat wrapped it, usually at a hyphen ("launchyournextchapter.com/economic-", 404 alert
// 2026-11-19). When the address is one segment that is the start of exactly one public top-level route, send it there.
// Only the top level: a cut-off slug deeper down could match the wrong employer or place.
const NOT_PUBLIC = new Set(['api', 'auth', 'dev-preview', 'functions', 'ingest'])
const TARGETS = [...APP_TOP_LEVEL].filter((r) => !r.includes('.') && !NOT_PUBLIC.has(r))
const MIN_PREFIX = 4

export function completeTruncatedTopLevel(pathname: string): string | null {
  const m = /^\/([a-z0-9-]+)\/?$/.exec(pathname)
  if (!m) return null
  const seg = m[1]
  if (seg.length < MIN_PREFIX || APP_TOP_LEVEL.has(seg)) return null
  const matches = TARGETS.filter((r) => r.startsWith(seg))
  return matches.length === 1 ? `/${matches[0]}` : null
}
