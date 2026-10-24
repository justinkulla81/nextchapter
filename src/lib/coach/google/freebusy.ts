import type { BusyInterval } from '@/lib/coach/booking/slots'

// Pure helpers for Google's free/busy answer, so slot filtering is tested without the network.

export interface FreeBusyResponse {
  calendars?: Record<string, { busy?: { start: string; end: string }[]; errors?: { domain?: string; reason?: string }[] }>
}

export interface ParsedFreeBusy {
  busy: BusyInterval[]
  /** Calendars Google would not answer for (not found, no access). The caller must not treat these as free. */
  failedCalendars: string[]
}

export function parseFreeBusy(response: FreeBusyResponse, requestedIds: string[]): ParsedFreeBusy {
  const busy: BusyInterval[] = []
  const failedCalendars: string[] = []
  for (const id of requestedIds) {
    const cal = response.calendars?.[id]
    // A calendar missing from the answer is as unknown as one with errors: never read it as "free".
    if (!cal || (cal.errors && cal.errors.length > 0)) {
      failedCalendars.push(id)
      continue
    }
    for (const b of cal.busy ?? []) {
      const startsAt = new Date(b.start)
      const endsAt = new Date(b.end)
      if (!Number.isNaN(startsAt.getTime()) && !Number.isNaN(endsAt.getTime()) && endsAt > startsAt) busy.push({ startsAt, endsAt })
    }
  }
  return { busy, failedCalendars }
}

/** Drops busy blocks that are exactly one given interval (a booking being moved must not block its own new time). */
export function withoutInterval(busy: BusyInterval[], interval: BusyInterval | null): BusyInterval[] {
  if (!interval) return busy
  return busy.filter((b) => !(b.startsAt.getTime() === interval.startsAt.getTime() && b.endsAt.getTime() === interval.endsAt.getTime()))
}
