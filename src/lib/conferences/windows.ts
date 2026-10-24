// Year-over-year prediction: when does an opportunity usually open or close, from the dates we stored in past editions.

export interface OppDates { type: string; opensAt: Date | null; deadline: Date | null }
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export interface Window { type: string; opensMonth: number | null; deadlineMonth: number | null; years: number }

const mode = (xs: number[]): number | null => {
  if (xs.length === 0) return null
  const c = new Map<number, number>()
  for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1)
  return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0]
}

/** One window per opportunity type, needing at least two years of history so a single data point is never presented as a pattern. */
export function predictWindows(history: OppDates[]): Window[] {
  const byType = new Map<string, OppDates[]>()
  for (const h of history) byType.set(h.type, [...(byType.get(h.type) ?? []), h])
  const out: Window[] = []
  for (const [type, rows] of byType) {
    const years = new Set(rows.map((r) => (r.deadline ?? r.opensAt)?.getUTCFullYear()).filter((y): y is number => y != null)).size
    if (years < 2) continue
    out.push({
      type,
      opensMonth: mode(rows.flatMap((r) => (r.opensAt ? [r.opensAt.getUTCMonth()] : []))),
      deadlineMonth: mode(rows.flatMap((r) => (r.deadline ? [r.deadline.getUTCMonth()] : []))),
      years,
    })
  }
  return out
}

export function windowSentence(label: string, w: Window): string | null {
  if (w.opensMonth != null) return `${label} usually open in ${MONTH[w.opensMonth]} (${w.years} years of history).`
  if (w.deadlineMonth != null) return `${label} usually close in ${MONTH[w.deadlineMonth]} (${w.years} years of history).`
  return null
}

/** A month to remind in: the one before the usual opening month, when the next edition has no live opening yet. */
export function remindMonth(w: Window): number | null {
  return w.opensMonth == null ? null : (w.opensMonth + 11) % 12
}
