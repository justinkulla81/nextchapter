import 'server-only'
import { prisma } from '@/lib/prisma'
import { buildSweepContext } from '@/lib/crm/sync'
import { classifyParticipant } from '@/lib/crm/sync-matching'
import { listCalendarEvents } from '@/lib/google/admin-calendar'
import { getValidAdminAccessToken } from '@/lib/webinars/admin-calendar-oauth'
import { captureServerEvent } from '@/lib/posthog/server'
import { sendOfferEmail, sendOfferProblemEmail, type OfferRow } from './email'

/** [start, end) of an Eastern-time calendar day, `offsetDays` from today. */
export function easternDayBounds(offsetDays: number, now = new Date()): { from: Date; to: Date } {
  const ymd = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  const base = new Date(`${ymd(now)}T12:00:00Z`)
  base.setUTCDate(base.getUTCDate() + offsetDays)
  const day = base.toISOString().slice(0, 10)
  // Midnight Eastern is 04:00 or 05:00 UTC; ask the zone which.
  const midnight = (d: string) => {
    for (const off of [4, 5]) {
      const t = new Date(`${d}T0${off}:00:00Z`)
      if (Number(t.toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false })) % 24 === 0) return t
    }
    return new Date(`${d}T05:00:00Z`)
  }
  const next = new Date(base); next.setUTCDate(next.getUTCDate() + 1)
  return { from: midnight(day), to: midnight(next.toISOString().slice(0, 10)) }
}

/** Find tomorrow's meetings with CRM people, record an offer for each, and email the choice. */
export async function offerTomorrowsPitches(): Promise<{ offered: number; sent: boolean; reason?: string; events?: number; unmatchedAttendees?: number }> {
  let token: string
  try { token = await getValidAdminAccessToken() } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    console.error('Meeting Prep offer: calendar token unavailable:', detail)
    await sendOfferProblemEmail('Your Google Calendar connection has expired or was revoked, so tomorrow\'s meetings could not be read.', detail)
    return { offered: 0, sent: false, reason: 'no_calendar_connection' }
  }

  const { from, to } = easternDayBounds(1)
  let events: Awaited<ReturnType<typeof listCalendarEvents>>, ctx: Awaited<ReturnType<typeof buildSweepContext>>
  try {
    ;[events, ctx] = await Promise.all([listCalendarEvents(token, from, to), buildSweepContext(null)])
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    console.error('Meeting Prep offer: calendar read failed:', detail)
    await sendOfferProblemEmail('Your calendar could not be read, so tomorrow\'s meetings were not checked.', detail)
    return { offered: 0, sent: false, reason: 'calendar_read_failed' }
  }

  const rows: OfferRow[] = []
  const unknown: { email: string; name: string | null; at: Date }[] = []
  const seen = new Set<string>()
  for (const ev of events) {
    for (const a of ev.attendees) {
      if (!a.email) continue
      const v = classifyParticipant(a.email, ctx)
      if (v.kind === 'unknown') { if (!seen.has(a.email)) { seen.add(a.email); unknown.push({ email: a.email, name: a.displayName, at: ev.start }) } continue }
      if (v.kind !== 'crm' || seen.has(v.personId)) continue
      seen.add(v.personId)
      const person = await prisma.crmPerson.findUnique({
        where: { id: v.personId },
        select: { id: true, fullName: true, deletedAt: true, roles: true, affiliations: { select: { org: true }, orderBy: [{ isPrimary: 'desc' }, { isCurrent: 'desc' }], take: 1 } },
      })
      if (!person || person.deletedAt) continue
      if (person.roles.length > 0 && person.roles.every((r) => r === 'FRIENDS_FAMILY')) continue
      const org = person.affiliations[0]?.org ?? null
      await prisma.crmRapSheet.upsert({
        where: { personId_eventId: { personId: person.id, eventId: ev.id } },
        create: { personId: person.id, orgId: org?.id ?? null, eventId: ev.id, meetingTitle: ev.summary, meetingAt: ev.start, offeredAt: new Date() },
        update: { meetingTitle: ev.summary, meetingAt: ev.start },
      })
      rows.push({ personId: person.id, personName: person.fullName, orgName: org?.name ?? null, title: ev.summary, at: ev.start, role: person.roles[0] ?? null })
    }
  }
  if (rows.length === 0) return { offered: 0, sent: false, reason: 'no_crm_pitches_tomorrow', events: events.length, unmatchedAttendees: unknown.length }
  const sent = await sendOfferEmail(rows, unknown)
  captureServerEvent('admin', 'rap_sheet_offer_sent', { pitches: rows.length, unknownAttendees: unknown.length, sent })
  return { offered: rows.length, sent }
}
