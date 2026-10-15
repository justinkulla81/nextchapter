// Shapes of the JSON columns on the InWork* tables, with tolerant parsers so a
// malformed or older row never breaks the page.

export type CheckItem = { id: string; text: string; done: boolean }
export type ActionItem = { id: string; text: string; done: boolean; sprintAddedAt?: string }

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function parseCheckItems(v: unknown): CheckItem[] {
  if (!Array.isArray(v)) return []
  return v.flatMap((x) =>
    isObj(x) && typeof x.id === 'string' && typeof x.text === 'string'
      ? [{ id: x.id, text: x.text, done: x.done === true }]
      : [],
  )
}

export function parseActionItems(v: unknown): ActionItem[] {
  if (!Array.isArray(v)) return []
  return v.flatMap((x) =>
    isObj(x) && typeof x.id === 'string' && typeof x.text === 'string'
      ? [{ id: x.id, text: x.text, done: x.done === true, ...(typeof x.sprintAddedAt === 'string' ? { sprintAddedAt: x.sprintAddedAt } : {}) }]
      : [],
  )
}

export function parseChecklistMap(v: unknown): Record<string, boolean> {
  if (!isObj(v)) return {}
  const out: Record<string, boolean> = {}
  for (const [k, val] of Object.entries(v)) if (typeof val === 'boolean') out[k] = val
  return out
}

export function parseStringList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

// "YYYY-MM-DD" <-> Date at UTC midnight.
export function parseDateOnly(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = new Date(`${s}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d
}

export function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10)
}
