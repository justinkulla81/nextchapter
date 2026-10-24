import { ACCESS_LABEL, FORMAT_LABEL, type Access, type ConferenceRow } from './types'

const usd = (n: number) => `$${n.toLocaleString('en-US')}`
const day = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

/** True when the dates on file are for an edition that has not ended. */
export function hasUpcomingDates(e: Pick<ConferenceRow, 'datesConfirmed' | 'startDate' | 'endDate'>, now = new Date()): boolean {
  if (!e.datesConfirmed || !e.startDate) return false
  return (e.endDate ?? e.startDate) >= startOfDay(now)
}

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

export function whenLabel(e: ConferenceRow, now = new Date()): string {
  if (hasUpcomingDates(e, now)) {
    const s = e.startDate!
    const t = e.endDate && e.endDate.getTime() !== s.getTime() ? e.endDate : null
    const yr = s.getUTCFullYear()
    return t ? `${day(s)} to ${day(t)}, ${yr}` : `${day(s)}, ${yr}`
  }
  return e.typicalMonth ? `Usually ${e.typicalMonth} (next dates not announced)` : 'Dates not announced'
}

export function whereLabel(e: ConferenceRow): string {
  if (e.format === 'VIRTUAL') return FORMAT_LABEL.VIRTUAL
  const place = [e.city, e.state ?? (e.country !== 'US' ? e.country : null)].filter(Boolean).join(', ')
  return place || FORMAT_LABEL[e.format as keyof typeof FORMAT_LABEL] || ''
}

/** The cost in one honest line: what it is, or that it was not checked. */
export function costLabel(e: ConferenceRow): string {
  const access = e.access as Access
  if (access === 'FREE') return e.costNote ? `Free. ${e.costNote}` : 'Free'
  if (access === 'INVITE') return e.costNote ? `By invitation only. ${e.costNote}` : 'By invitation only'
  if (access === 'APPLY') return e.costNote ? `Apply to attend. ${e.costNote}` : 'Apply to attend'
  const range =
    e.costLow != null && e.costHigh != null && e.costHigh !== e.costLow
      ? `${usd(e.costLow)} to ${usd(e.costHigh)}`
      : e.costLow != null
        ? access === 'MIXED' ? usd(e.costLow) : `About ${usd(e.costLow)}`
        : e.costHigh != null
          ? `Up to ${usd(e.costHigh)}`
          : null
  const lead = access === 'MIXED' ? 'Free expo floor; session passes' : 'Ticket'
  if (!range) return e.costNote ? `${ACCESS_LABEL[access] ?? 'Paid'}. ${e.costNote}` : `${ACCESS_LABEL[access] ?? 'Paid ticket'}, price not listed`
  return e.costNote ? `${lead} ${range}. ${e.costNote}` : `${lead} ${range}`
}

/** Costs money to attend (so the page can say "paid" plainly). */
export const isPaid = (e: Pick<ConferenceRow, 'access'>) => e.access === 'PAID' || e.access === 'MIXED'
