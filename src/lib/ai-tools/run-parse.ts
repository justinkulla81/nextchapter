// Pure helpers for reading a model reply. Kept apart from run.ts (which is server-only and calls the model) so they are tested.

/** Pulls the first JSON object out of a model reply, or null. Models sometimes wrap JSON in prose or a code fence. */
export function parseJsonObject(text: string): unknown {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    return JSON.parse(m[0])
  } catch {
    return null
  }
}

/** A trimmed string of at most `max` characters, or null when it is not a non-empty string. */
export const cleanText = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
