// The "what if I took a pause?" arithmetic, from the member's own number. Pure and client-safe.
// Nothing is saved or implied about pay or hiring; it only says how long their cushion lasts.

export const PAUSE_CHOICES = [3, 6, 12] as const

export type PauseSummary = { known: boolean; headline: string; detail: string; extraMonths: number; barPct: number }

export function pauseSummary(cushionMonths: number | null, pauseMonths: number): PauseSummary {
  if (cushionMonths === null) {
    return { known: false, headline: 'Tell us how many months of expenses you have saved to see how it lines up.', detail: 'A rough number is fine. It stays with you.', extraMonths: 0, barPct: 0 }
  }
  const extra = Math.max(0, Math.round((pauseMonths - cushionMonths) * 2) / 2)
  const barPct = Math.min(100, (cushionMonths / Math.max(pauseMonths, cushionMonths, 6)) * 100)
  if (pauseMonths === 0) return { known: true, headline: 'Choose a length to see how it lines up.', detail: 'Nothing here is saved. It is a way to try an idea on.', extraMonths: 0, barPct }
  if (extra === 0) return { known: true, headline: `Your cushion covers a ${pauseMonths}-month pause.`, detail: 'That leaves room to rest, and to start the return a little before you need to.', extraMonths: 0, barPct }
  return {
    known: true,
    headline: `A ${pauseMonths}-month pause is within reach, with about ${extra} more ${extra === 1 ? 'month' : 'months'} to line up.`,
    detail: 'Common ways people bridge it: a few months of fractional or part-time work, a smaller monthly need, or a phased return. We can sketch each one for you.',
    extraMonths: extra,
    barPct,
  }
}

export const PAUSE_CHECKLIST = [
  'When your health coverage and any severance end, and what covers the gap',
  'Anything that vests before a date you might leave',
  'One or two people to stay warm with, so coming back is easy',
  'A sentence for your story: why you paused, and what you brought back',
] as const
