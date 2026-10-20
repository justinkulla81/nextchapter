// What happens to a person when an employer-sponsored seat ends, said plainly. Pure and client-safe.
// The rule: what a person wrote, planned or explored is theirs and stays; only what the employer
// paid for (coaching sessions, the recruiter network) stops. Their journey is never changed back.

import type { ProgramKind } from './program-wording'

export const NOTICE_WINDOW_DAYS = 30

export type Continuity = { stays: string[]; ends: string[]; next: string }

export function continuityCopy(kind: ProgramKind): Continuity {
  const common = ['Your account, free, for as long as you want it', 'Your profile, résumé and documents']
  if (kind === 'GROWTH') {
    return {
      stays: [...common, 'Your career story, goals and learning paths', 'Your pay research and the case you built for your next review', 'Your plan and where you are on it'],
      ends: ['Coaching sessions your employer provided', 'The recruiter network, if your program included it'],
      next: 'Nothing changes about your plan on that day. If you want coaching or the recruiter network to continue, membership picks it up.',
    }
  }
  return {
    stays: [...common, 'Your search plan and the jobs you are tracking', 'Your contacts and your notes'],
    ends: ['Coaching sessions your employer provided', 'The recruiter network, if your program included it'],
    next: 'Your search carries on as it is. If you want coaching or the recruiter network to continue, membership picks it up.',
  }
}

export type SeatEnding = { endsAt: Date; daysLeft: number; orgName: string; kind: ProgramKind }

export function endingSoon(seats: { endsAt: Date | null; orgName: string; kind: ProgramKind }[], now = new Date()): SeatEnding | null {
  const upcoming = seats
    .filter((s): s is { endsAt: Date; orgName: string; kind: ProgramKind } => !!s.endsAt && s.endsAt.getTime() > now.getTime())
    .map((s) => ({ ...s, daysLeft: Math.ceil((s.endsAt.getTime() - now.getTime()) / 86_400_000) }))
    .filter((s) => s.daysLeft <= NOTICE_WINDOW_DAYS)
    .sort((a, b) => a.daysLeft - b.daysLeft)
  return upcoming[0] ?? null
}
