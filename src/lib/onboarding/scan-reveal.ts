// The Google reveal at the end of onboarding: what a Gmail and Calendar scan found, each with the reason it
// helps, in positive words. Counts come from what the sync really stored (TrackedEmailActivity and
// TrackedCalendarEvent); we never show a number we did not count. Pure: scan-reveal.test.ts.

export interface ScanCounts {
  applications: number
  recruiterMessages: number
  interviewInvites: number
  networkingMessages: number
  offers: number
  calendarInterviews: number
  calendarNetworkingCalls: number
}

export const EMPTY_SCAN: ScanCounts = {
  applications: 0,
  recruiterMessages: 0,
  interviewInvites: 0,
  networkingMessages: 0,
  offers: 0,
  calendarInterviews: 0,
  calendarNetworkingCalls: 0,
}

/** Turns the stored rows (grouped by type) into counts. Unknown types are ignored. */
export function countsFromGroups(emailRows: readonly { type: string; count: number }[], calendarRows: readonly { type: string; count: number }[]): ScanCounts {
  const by = (rows: readonly { type: string; count: number }[], ...types: string[]) => rows.filter((r) => types.includes(r.type)).reduce((a, r) => a + r.count, 0)
  return {
    applications: by(emailRows, 'APPLICATION_CONFIRMATION'),
    recruiterMessages: by(emailRows, 'RECRUITER_OUTREACH'),
    interviewInvites: by(emailRows, 'INTERVIEW_INVITE'),
    networkingMessages: by(emailRows, 'NETWORKING_OUTREACH', 'INTRO_REQUEST'),
    offers: by(emailRows, 'OFFER'),
    calendarInterviews: by(calendarRows, 'INTERVIEW'),
    calendarNetworkingCalls: by(calendarRows, 'NETWORKING_CALL'),
  }
}

export interface Finding {
  key: string
  /** "14 applications you already sent" */
  title: string
  /** Why it helps. */
  why: string
}

const plural = (n: number, one: string, many: string) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`

/** The findings worth showing: only what was found, most useful first. */
export function describeFindings(c: ScanCounts): Finding[] {
  const out: Finding[] = []
  if (c.applications > 0) out.push({ key: 'applications', title: `${plural(c.applications, 'application', 'applications')} you already sent`, why: 'They count toward your effort, so you do not retype them and your progress starts above zero.' })
  const interviews = c.interviewInvites + c.calendarInterviews
  if (interviews > 0) out.push({ key: 'interviews', title: `${plural(interviews, 'interview or interview invite', 'interviews or interview invites')}`, why: 'We can show where your searches move forward, and prepare you for the next round.' })
  if (c.recruiterMessages > 0) out.push({ key: 'recruiters', title: `${plural(c.recruiterMessages, 'message from a recruiter', 'messages from recruiters')}`, why: 'These are people who already want to talk to you. We list them so none goes cold.' })
  const networking = c.networkingMessages + c.calendarNetworkingCalls
  if (networking > 0) out.push({ key: 'networking', title: `${plural(networking, 'conversation with someone you know', 'conversations with people you know')}`, why: 'We remind you who is due a follow-up, which is how most roles are found.' })
  if (c.offers > 0) out.push({ key: 'offers', title: `${plural(c.offers, 'offer', 'offers')}`, why: 'We keep the dates and details together so you can compare and decide calmly.' })
  return out
}

/** Why connecting helps, shown before connecting. Specific to what we will look for, and says what we do not do. */
export const WHY_CONNECT: readonly string[] = [
  'Applications you sent, replies and interview invites are logged for you, so you never enter them by hand.',
  'Recruiters and people you already know are listed, with who is due a follow-up.',
  'Real activity counts toward your dossier, so the effort you have already made is not lost.',
]

export const CONNECT_REASSURANCE = 'Read-only. We can never send, edit or delete anything. You can disconnect any time.'

export type RevealState = 'not_connected' | 'scanning' | 'found' | 'nothing_yet'

/** What the page shows now. A scan counts as done once both connections have synced at least once. */
export function revealState(input: { connected: boolean; syncedAll: boolean; counts: ScanCounts }): RevealState {
  if (!input.connected) return 'not_connected'
  if (describeFindings(input.counts).length > 0) return 'found'
  return input.syncedAll ? 'nothing_yet' : 'scanning'
}
