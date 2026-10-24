// Turns what the weekly re-check read off a page into reviewable changes. Pure: no fetching, no writes.
import { OPPORTUNITY_TYPES, type OpportunityType } from './constants'

export interface SeenOpportunity { type: OpportunityType; title: string; url: string | null; deadline: string | null; opensAt: string | null }
export interface KnownOpportunity { type: string; url: string | null; deadline: Date | null; title: string }

const isoDay = (d: Date) => d.toISOString().slice(0, 10)
const sameTarget = (a: string | null, b: string | null) => !!a && !!b && a.replace(/\/+$/, '').toLowerCase() === b.replace(/\/+$/, '').toLowerCase()

export type PendingChange =
  | { kind: 'DATES'; start: string; end: string }
  | { kind: 'NEW_OPPORTUNITY'; opportunity: SeenOpportunity }
  | { kind: 'OPPORTUNITY_DEADLINE'; title: string; type: string; url: string | null; from: string | null; to: string }

/** Compare what the page shows now with what we hold. Anything different becomes a pending change; nothing is overwritten. */
export function diffAgainstCatalog(
  seen: { dates: { start: string; end: string } | null; opportunities: SeenOpportunity[] },
  held: { startDate: Date | null; endDate: Date | null; datesConfirmed: boolean; opportunities: KnownOpportunity[] },
): PendingChange[] {
  const out: PendingChange[] = []
  if (seen.dates) {
    const same = held.startDate && isoDay(held.startDate) === seen.dates.start && isoDay(held.endDate ?? held.startDate) === seen.dates.end
    if (!same) out.push({ kind: 'DATES', start: seen.dates.start, end: seen.dates.end })
  }
  for (const o of seen.opportunities) {
    if (!OPPORTUNITY_TYPES.includes(o.type)) continue
    const known = held.opportunities.find((k) => k.type === o.type && (sameTarget(k.url, o.url) || (!o.url && k.title.toLowerCase() === o.title.toLowerCase())))
    if (!known) { out.push({ kind: 'NEW_OPPORTUNITY', opportunity: o }); continue }
    if (o.deadline && (!known.deadline || isoDay(known.deadline) !== o.deadline)) {
      out.push({ kind: 'OPPORTUNITY_DEADLINE', title: known.title, type: known.type, url: known.url, from: known.deadline ? isoDay(known.deadline) : null, to: o.deadline })
    }
  }
  return out
}
