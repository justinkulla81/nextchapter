// Reads a platform's own email and says which stage it proves. Pure (no
// DB, no I/O) so every phrase list is unit-tested. Only ever runs on mail
// already matched to a directory entry by sender domain (track.ts), so the
// phrases here never have to guess whether an arbitrary sender is a
// platform.

import type { PlatformKind } from './directory'

export type PlatformStageKey =
  | 'SIGNED_UP'
  | 'IN_VETTING'
  | 'ACCEPTED'
  | 'WORKING'
  | 'EARNING'
  | 'ENROLLED'
  | 'LEARNING'
  | 'EXAM_BOOKED'
  | 'COMPLETED'

export type PlatformSignal = 'NOT_ACCEPTED' | 'FALLING_BEHIND' | 'NUDGE'

export const STAGE_ORDER: Record<PlatformKind, PlatformStageKey[]> = {
  WORK: ['SIGNED_UP', 'IN_VETTING', 'ACCEPTED', 'WORKING', 'EARNING'],
  LEARNING: ['SIGNED_UP', 'ENROLLED', 'LEARNING', 'EXAM_BOOKED', 'COMPLETED'],
}

export const STAGE_LABEL: Record<PlatformStageKey, string> = {
  SIGNED_UP: 'Signed up',
  IN_VETTING: 'In vetting',
  ACCEPTED: 'Accepted',
  WORKING: 'Working',
  EARNING: 'Earning',
  ENROLLED: 'Enrolled',
  LEARNING: 'Learning',
  EXAM_BOOKED: 'Exam booked',
  COMPLETED: 'Completed',
}

export function stageRank(kind: PlatformKind, stage: PlatformStageKey): number {
  return STAGE_ORDER[kind].indexOf(stage)
}

const APOS = "(?:'|’)"
const re = (s: string) => new RegExp(s.replace(/'/g, APOS), 'i')

// ── Work ────────────────────────────────────────────────────────────────
const WORK_NOT_ACCEPTED = [
  re("\\bunfortunately\\b"),
  re("\\bnot (?:be )?(?:moving|move) forward\\b"),
  re("\\b(?:were|was|have been) not (?:selected|approved|accepted)\\b"),
  re("\\bnot (?:a )?(?:fit|match) (?:at this time|right now)\\b"),
  re("\\bunable to (?:approve|accept) your\\b"),
  re("\\bapplication (?:was|has been) (?:declined|rejected)\\b"),
]
const WORK_STAGES: [PlatformStageKey, RegExp[]][] = [
  ['EARNING', [
    re("\\b(?:payment|payout|transfer|withdrawal) (?:has been |was |is )?(?:sent|processed|initiated|issued|completed|on (?:its|the) way)\\b"),
    re("\\byou(?:'ve| have) (?:been |just been )?paid\\b"),
    re("\\byou(?:'ve| have) received (?:a )?(?:payment|payout|\\$)"),
    re("\\binvoice\\b.{0,40}\\b(?:paid|payment received)\\b"),
    re("\\b(?:earnings|payment) (?:summary|statement|receipt|remittance)\\b"),
    re("\\bhonorarium (?:has been |was )?(?:paid|sent|processed|issued)\\b"),
    re("\\bsubmitted a payment to you\\b"),
  ]],
  ['WORKING', [
    re("\\b(?:new|your) (?:project|task|tasks|assignment|engagement|contract|gig|opportunity) (?:is |are |has been )?(?:available|assigned|ready|confirmed|starting|starts|kicks off)\\b"),
    re("\\byou(?:'ve| have) been (?:matched|selected|staffed|assigned|hired|booked)\\b"),
    // A scheduled paid call (expert networks send these as calendar
    // invites: "Tegus Compensated Consulting Call @ Fri…").
    re("\\b(?:compensated|paid|research|consulting|expert|advisory) (?:consulting |research )?call\\b"),
    re("\\b(?:call|consultation) (?:scheduled|confirmed|is booked)\\b"),
    re("\\btimesheet\\b"),
    re("\\bstatement of work\\b"),
    re("\\bcontract (?:has been |was )?(?:signed|executed|started|offer)\\b"),
    re("\\boffer (?:for|to join) (?:the )?(?:project|engagement|contract)\\b"),
  ]],
  ['ACCEPTED', [
    re("\\byou(?:'ve| have) been (?:approved|accepted|verified|vetted)\\b"),
    re("\\byou(?:'re| are) (?:approved|accepted|in)\\b(?! the (?:queue|running))"),
    re("\\b(?:application|profile|account) (?:has been |is |was )?(?:approved|accepted|verified|activated)\\b"),
    re("\\bwelcome to the (?:network|team|talent network|community of experts|expert network|platform)\\b"),
    re("\\bcongratulations\\b.{0,60}\\b(?:approved|accepted|passed|qualified|vetted)\\b"),
    re("\\byou passed\\b"),
    re("\\bonboarding (?:is )?complete\\b"),
    re("\\baccept(?:ed|ing) the terms of engagement\\b"),
    // Only approved members get "new tasks/projects available" digests.
    re("\\bnew (?:work|tasks?|projects?) (?:available|for you)\\b"),
    re("\\b(?:now )?(?:eligible|qualified) (?:for|to (?:work|take|receive))\\b"),
  ]],
  ['IN_VETTING', [
    re("\\b(?:assessment|skills? test|technical (?:test|screen)|coding (?:test|challenge)|screening|vetting|background check|qualification (?:test|exam)|ai interview)\\b"),
    re("\\binterview (?:invitation|invite|scheduled|confirmation|is confirmed|request)\\b"),
    re("\\b(?:schedule|book|complete|take|start) (?:your |the )?(?:interview|assessment|test|screening)\\b"),
    re("\\bunder review\\b"),
    re("\\bwe(?:'ve| have) received your application\\b"),
  ]],
  ['SIGNED_UP', [
    re("\\bwelcome to\\b"),
    re("\\b(?:verify|confirm|activate) your (?:email|account|registration|profile)\\b"),
    re("\\bcomplete your (?:profile|application|registration|signup|sign-up|onboarding)\\b"),
    re("\\bthanks? (?:you )?for (?:signing up|joining|registering|applying|your application|your interest)\\b"),
    re("\\baccount (?:has been |was )?created\\b"),
    re("\\bapplication (?:received|submitted)\\b"),
  ]],
]

// ── Learning ────────────────────────────────────────────────────────────
const LEARNING_STAGES: [PlatformStageKey, RegExp[]][] = [
  ['COMPLETED', [
    re("\\bcongratulations[,!]? you(?:'ve| have) (?:successfully )?(?:completed|finished|passed|earned|graduated)\\b"),
    re("\\byou(?:'ve| have) (?:successfully )?(?:completed|finished|passed)\\b(?! (?:module|week|lesson|unit|\\d|the first|your first|\\w+ of))"),
    re("\\byou(?:'ve| have) (?:been awarded|earned) (?:a|an|your|the) (?:new )?(?:badge|certificate|credential|certification|degree|diploma)\\b"),
    re("\\byour (?:certificate|credential|badge|diploma|transcript) (?:is ready|has been issued|is available|has been awarded)\\b"),
    re("\\b(?:badge|certificate|credential) (?:awarded|issued|earned)\\b"),
    re("\\b(?:accept|claim) your (?:badge|credential|certificate)\\b"),
    re("\\byou(?:'re| are) (?:now )?(?:certified|a certified)\\b"),
    re("\\b(?:exam|test) (?:result|results|score)s?\\b.{0,40}\\bpass"),
    re("\\bdegree (?:has been )?(?:conferred|awarded)\\b"),
    re("\\bcourse complete\\b"),
  ]],
  ['EXAM_BOOKED', [
    re("\\b(?:exam|test) (?:appointment|registration|confirmation|booking|is scheduled|scheduled)\\b"),
    re("\\bappointment (?:confirmation|confirmed)\\b.{0,60}\\b(?:exam|test)\\b"),
    re("\\bauthori[sz]ation to test\\b"),
    re("\\beligib(?:le|ility)\\b.{0,30}\\b(?:exam|test)\\b"),
    re("\\byour (?:exam|test) (?:is )?(?:tomorrow|coming up|in \\d+ days?)\\b"),
  ]],
  ['LEARNING', [
    re("\\b(?:assignment|quiz|project|submission|exercise|lab) (?:has been |was )?(?:graded|submitted|received|reviewed|passed)\\b"),
    re("\\byour (?:grade|score|feedback) (?:is|for)\\b"),
    re("\\byou(?:'ve| have) (?:completed|finished|passed) (?:module|week|lesson|unit|chapter|\\d+%|\\d+ (?:of|lessons?|modules?))\\b"),
    re("\\b(?:module|week|lesson|unit|chapter) \\d+\\b.{0,40}\\b(?:complete|completed|unlocked|now available|is open|starts)\\b"),
    re("\\b\\d{1,3}% (?:complete|done|through|of the way)\\b"),
    re("\\b(?:weekly|monthly) (?:progress|learning) (?:report|summary|recap)\\b"),
    re("\\byour (?:learning )?progress\\b"),
    re("\\b\\d+[- ]day streak\\b"),
    re("\\b(?:class|session|lecture|live session|office hours|cohort) (?:starts|reminder|recording|is today|tomorrow)\\b"),
    re("\\b(?:next|upcoming) (?:lesson|module|week|class|session)\\b"),
  ]],
  ['ENROLLED', [
    re("\\byou(?:'re| are) (?:now )?(?:enrolled|registered)\\b"),
    re("\\b(?:enrollment|enrolment|registration|admission) (?:is )?(?:confirmed|confirmation|complete|successful)\\b"),
    re("\\byou(?:'ve| have) (?:successfully )?(?:enrolled|registered|been admitted|been accepted)\\b"),
    re("\\bthank(?:s| you) for (?:enrolling|registering|your (?:purchase|order|payment|enrollment))\\b"),
    re("\\bwelcome to (?:the |your )?(?:course|program|programme|class|cohort|bootcamp|specialization|certificate|track|learning path|professional certificate)\\b"),
    re("\\b(?:order|payment|purchase) (?:confirmation|receipt|confirmed)\\b"),
    re("\\bcongratulations\\b.{0,40}\\b(?:admitted|admission|accepted)\\b"),
    re("\\byour (?:course|program|class) (?:starts|begins|is starting)\\b"),
  ]],
  ['SIGNED_UP', [
    re("\\bwelcome to\\b"),
    re("\\b(?:verify|confirm|activate) your (?:email|account)\\b"),
    re("\\baccount (?:has been |was )?created\\b"),
    re("\\bthanks? (?:you )?for (?:signing up|joining|creating)\\b"),
  ]],
]

const FALLING_BEHIND = [
  re("\\byou(?:'re| are) (?:falling |a (?:little|bit) )?behind\\b"),
  re("\\bmissed (?:a |the |your )?(?:deadline|due date)\\b"),
  re("\\b(?:deadline|due date) (?:is )?(?:approaching|tomorrow|today|passed)\\b"),
  re("\\boverdue\\b"),
  re("\\bcatch up\\b"),
]
const NUDGE = [
  re("\\bwe miss(?:ed)? you\\b"),
  re("\\bhaven't seen you\\b"),
  re("\\bit's been a while\\b"),
  re("\\bcome back\\b"),
  re("\\bstill interested\\b"),
  re("\\bpick up where you left off\\b"),
  re("\\byour (?:account|profile) (?:is|has been|will be) (?:inactive|deactivated|paused)\\b"),
]

// Stages a long email body may prove on its own. Everything else must be
// in the subject: bodies of invitations and surveys mention "screening",
// "assessment" and "project" in passing.
const BODY_STAGES = new Set<PlatformStageKey>(['SIGNED_UP', 'ENROLLED'])

export interface PlatformEmailReading {
  stage: PlatformStageKey | null
  signal: PlatformSignal | null
}

/**
 * Subject first, then the opening of the body: subjects are the platform's
 * own label for the email, while long marketing bodies mention every stage
 * in passing ("earn your certificate", "join our network"). Signals are
 * read from the subject only for the same reason.
 */
export function readPlatformEmail(kind: PlatformKind, subject: string, body: string): PlatformEmailReading {
  const opening = body.slice(0, 600)
  const subjectHit = (list: RegExp[]) => list.some((r) => r.test(subject))

  let signal: PlatformSignal | null = null
  if (kind === 'WORK' && subjectHit(WORK_NOT_ACCEPTED)) signal = 'NOT_ACCEPTED'
  else if (subjectHit(NUDGE)) signal = 'NUDGE'
  else if (kind === 'LEARNING' && subjectHit(FALLING_BEHIND)) signal = 'FALLING_BEHIND'
  // A rejection's body still says "thanks for applying" — never also read
  // it as a forward stage.
  if (signal === 'NOT_ACCEPTED' || signal === 'NUDGE') return { stage: null, signal }

  const stages = kind === 'WORK' ? WORK_STAGES : LEARNING_STAGES
  for (const [stage, patterns] of stages) {
    if (patterns.some((r) => r.test(subject))) return { stage, signal }
  }
  for (const [stage, patterns] of stages) {
    if (BODY_STAGES.has(stage) && patterns.some((r) => r.test(opening))) return { stage, signal }
  }
  return { stage: null, signal }
}

// "Congratulations on completing Google Data Analytics!" → the course name,
// for the Executive Dossier's completed-learning list. Conservative: only
// a few fixed subject shapes, never a guess from the body.
const TITLE_PATTERNS = [
  re("\\b(?:completing|completed|finishing|finished|passing|passed) (?:the |your )?[\"“]?(.{4,100}?)[\"”]?(?:[!.]|$| on (?:coursera|edx|udemy)| - | \\| )"),
  re("\\b(?:earned|been awarded|received) (?:a |an |the |your )?(?:new )?(?:badge|certificate|credential)(?: for| in|:)? [\"“]?(.{4,100}?)[\"”]?(?:[!.]|$| from | - | \\| )"),
  re("\\byour (?:certificate|credential|badge) (?:for|in) [\"“]?(.{4,100}?)[\"”]?(?: is| has|[!.]|$)"),
]

export function extractCompletedTitle(subject: string): string | null {
  for (const r of TITLE_PATTERNS) {
    const m = subject.match(r)
    const title = m?.[1]?.trim().replace(/^(?:course|program|programme|certificate)\s*:?\s*/i, '')
    if (title && title.length >= 4 && !/^(?:it|this|the course|your course|a course|module|week|lesson)\b/i.test(title)) return title
  }
  return null
}

// Platform mail is overwhelmingly automated; a personal note from someone
// who works there ("Hi, I'm a recruiter at Mercor") is still real signal on
// a dedicated domain, but on a shared domain (a university, linkedin.com)
// only automated mail counts.
export function looksAutomated(fromHeader: string, hasListUnsubscribe: boolean): boolean {
  if (hasListUnsubscribe) return true
  const address = (fromHeader.match(/<([^>]+)>/)?.[1] ?? fromHeader).toLowerCase()
  const local = address.split('@')[0] ?? ''
  return /no-?reply|do-?not-?reply|notification|notify|alerts?|info|hello|team|support|updates?|news|learn|learning|mail|account|accounts|community|courses?|admissions?|registrar|certif|exam|billing|payments?|talent|careers?|members?|program|academy|bounce/.test(local)
}
