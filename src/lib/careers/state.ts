import { STATE_NAMES } from '@/lib/workforce/places'

/** "MA" | "ma" | "Massachusetts" -> "MA"; anything else -> null. */
export function toStateCode(state: string | null | undefined): string | null {
  if (!state) return null
  const t = state.trim()
  if (!t) return null
  if (STATE_NAMES[t.toUpperCase()]) return t.toUpperCase()
  const lower = t.toLowerCase()
  const entry = Object.entries(STATE_NAMES).find(([, name]) => name.toLowerCase() === lower)
  return entry ? entry[0] : null
}
