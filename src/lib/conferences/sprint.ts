// What the Weekly Search Sprint suggests from a member's conferences: real deadlines, real dates, nothing invented.
// Pure: the loader (sprint-data.ts) reads the database, this decides. One suggestion per action type, because the
// Sprint keeps one row per type per week.
import { ACTIONABLE_TYPES, type OpportunityType } from './constants'

const DAY = 86_400_000
/** Deadlines closing within this many days are worth a Sprint line. */
export const DEADLINE_HORIZON_DAYS = 30
/** Registration is worth suggesting this far ahead of the start date (earlier tickets cost less). */
export const REGISTER_HORIZON_DAYS = 120

export interface FollowedConference { seriesId: string; name: string; status: string; startDate: Date | null; endDate: Date | null; datesConfirmed: boolean }
export interface OpenOpportunity { id: string; seriesId: string; type: string; title: string; deadline: Date | null }
export interface ConferenceSuggestion { text: string; actionType: 'CONFERENCE_SUBMISSION' | 'CONFERENCE_REGISTER' | 'ENGAGE_EVENT' }

const startOfDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
const short = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
function range(a: Date, b: Date | null): string {
  return b && b.getTime() !== a.getTime() ? `${short(a)} to ${short(b)}` : short(a)
}

function submissionText(type: OpportunityType, name: string, title: string, closes: Date): string {
  const when = `closes ${short(closes)}`
  const why = ' — speaking, entering and presenting put your work in front of the people who hire'
  switch (type) {
    case 'CALL_FOR_SPEAKERS': return `Send your speaker proposal to ${name} (${when})${why}`
    case 'CALL_FOR_SUBMISSIONS': return `Submit your paper or proposal to ${name} (${when})${why}`
    case 'CONTEST': return `Enter ${title} at ${name} (${when})${why}`
    case 'AWARD': return `Put yourself or your work forward for ${title} at ${name} (${when})${why}`
    default: return `Apply to show a demo at ${name} (${when})${why}`
  }
}

export function conferenceSuggestions(
  followed: FollowedConference[],
  opportunities: OpenOpportunity[],
  /** opportunityId -> the member's stage on it */
  stages: Map<string, string>,
  now = new Date(),
): ConferenceSuggestion[] {
  const today = startOfDay(now)
  const live = followed.filter((f) => f.status !== 'SKIPPED')
  const byId = new Map(live.map((f) => [f.seriesId, f]))
  const out: ConferenceSuggestion[] = []

  // 1. The soonest open deadline on a conference the member follows that they have not yet sent.
  const closing = opportunities
    .filter((o) => o.deadline && byId.has(o.seriesId) && ACTIONABLE_TYPES.includes(o.type as OpportunityType))
    .filter((o) => o.deadline! >= today && o.deadline!.getTime() - today.getTime() <= DEADLINE_HORIZON_DAYS * DAY)
    .filter((o) => { const st = stages.get(o.id); return !st || st === 'WATCHING' || st === 'DRAFTING' })
    .sort((a, b) => a.deadline!.getTime() - b.deadline!.getTime())[0]
  if (closing) out.push({ actionType: 'CONFERENCE_SUBMISSION', text: submissionText(closing.type as OpportunityType, byId.get(closing.seriesId)!.name, closing.title, closing.deadline!) })

  // 2. Attend: a conference the member is registered for that is on this week or about to be.
  const attending = live
    .filter((f) => ['REGISTERED', 'ATTENDING', 'SPEAKING'].includes(f.status) && f.datesConfirmed && f.startDate)
    .filter((f) => f.startDate!.getTime() - today.getTime() <= 7 * DAY && (f.endDate ?? f.startDate!) >= today)
    .sort((a, b) => a.startDate!.getTime() - b.startDate!.getTime())[0]
  if (attending) out.push({ actionType: 'ENGAGE_EVENT', text: `Attend ${attending.name} (${range(attending.startDate!, attending.endDate)}) and speak to three new people` })

  // 3. Register: dates are confirmed, it is coming up, and the member has not said they are registered.
  const toRegister = live
    .filter((f) => ['INTERESTED', 'TRACKING'].includes(f.status) && f.datesConfirmed && f.startDate)
    .filter((f) => f.startDate! >= today && f.startDate!.getTime() - today.getTime() <= REGISTER_HORIZON_DAYS * DAY)
    .sort((a, b) => a.startDate!.getTime() - b.startDate!.getTime())[0]
  if (toRegister) out.push({ actionType: 'CONFERENCE_REGISTER', text: `Register for ${toRegister.name} (${range(toRegister.startDate!, toRegister.endDate)}), or tell us you are skipping it` })
  return out
}

/** Only the "log who you met" prompt belongs in the follow-ups list (it is about people). Deadlines and dates are Sprint lines. */
export const isFollowUpPrompt = (item: { kind: string }): boolean => item.kind === 'log_people'
