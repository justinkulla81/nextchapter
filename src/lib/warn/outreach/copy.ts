/**
 * Layoff outreach copy v4 (owner, 2026-11-20). v3 (one offer, no introduction, a link-or-call ask) drew no reply: nobody knows what
 * NextChapter is. v4 says who is writing and why: the long-search figure, what NextChapter does (an AI agent runs each person's search,
 * and AI skills retraining), how it sits alongside outplacement and training the reader already has, the AI-skill pay premium, then a
 * call ask with a reason to act now. No link in the first email. Subjects are unchanged and sentence case. Pure, so the words and the
 * two tests are tested.
 *
 * Two tests run at once, each on its own hash of the address, so each is judged on half the list:
 * - the opener: A opens "I'm Justin, founder of NextChapter. I started it because..."; B puts the introduction in the second paragraph.
 * - the close: 'days' asks "Do you have 20 minutes Tuesday or Wednesday?" (days picked from the send date); 'week' asks "What day next
 *   week works for 20 minutes?". A held draft (the backfill) has no known send day, so it always gets 'week'.
 * Rapid Response (about 36 addresses) is too small to test: opener A, close 'days'.
 *
 * Figures (keep true): ~1.9 million unemployed 27+ weeks, BLS monthly average January to September 2026 (October report); postings
 * that ask for an AI skill advertise 19.3% more pay like for like (https://launchyournextchapter.com/resources/ai-skills-pay-premium).
 */
import { STATE_NAMES } from '@/lib/workforce/places'
import type { LocalPicture } from '@/lib/warn/layoff-picture'
import { cleanEmployerName } from './employer-name'

export type CopyAudience = 'hr' | 'job_center' | 'workforce_board' | 'economic_development' | 'rapid_response'
export type CopyMode = 'new' | 'older'
/** The opener test: A introduces Justin first; B puts the introduction in the second paragraph. */
export type AskArm = 'A' | 'B'
/** The close test. */
export type CloseArm = 'days' | 'week'

const hash = (s: string) => {
  let h = 0
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h
}
const norm = (email: string) => email.trim().toLowerCase()

/** The opener arm, by a hash of the address. Rapid Response is not tested and gets A. */
export function askArm(email: string, audience: CopyAudience): AskArm {
  if (audience === 'rapid_response') return 'A'
  return hash(norm(email)) % 2 === 0 ? 'A' : 'B'
}

/** The close arm, by a second, independent hash of the address. A held draft has no send day, so it gets 'week'. */
export function closeArm(email: string, audience: CopyAudience, held = false): CloseArm {
  if (held) return 'week'
  if (audience === 'rapid_response') return 'days'
  // FNV-1a, not the opener's hash: a prefix on the same multiply-by-31 hash keeps its parity, so the two splits would be one split.
  let h = 0x811c9dc5
  for (const ch of norm(email)) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0
  return (h >>> 16) % 2 === 0 ? 'days' : 'week'
}

/** The edition's version label: the two arms together, e.g. "A-days". */
export const variantLabel = (opener: AskArm, close: CloseArm) => `${opener}-${close}`

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * The two days the 'days' close offers, from the day the email sends (Eastern; the layoff window is 8 a.m. to noon, so a later send
 * goes the next morning). Two weekdays in a row, at least two days out, never Monday or Friday: sent Monday, Wednesday or Thursday;
 * sent Saturday or Sunday, the coming Tuesday or Wednesday; sent Tuesday to Friday, next week's Tuesday or Wednesday.
 */
export function meetingDays(sendAt: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', hourCycle: 'h23' }).formatToParts(sendAt)
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.find((p) => p.type === 'weekday')!.value)
  const hour = Number(parts.find((p) => p.type === 'hour')!.value)
  const day = hour >= 12 ? (wd + 1) % 7 : wd
  if (day === 1) return `${WEEKDAY[3]} or ${WEEKDAY[4]}`
  if (day === 0 || day === 6) return `${WEEKDAY[2]} or ${WEEKDAY[3]}`
  return `next ${WEEKDAY[2]} or ${WEEKDAY[3]}`
}

export const WEEK_ASK = 'What day next week works for 20 minutes?'
export const daysAsk = (sendAt: Date) => `Do you have 20 minutes ${meetingDays(sendAt)}?`

export const LONG_SEARCH = 'nearly 2 million Americans have now been looking for work for six months or more'
export const AI_PAY = 'Jobs that ask for those skills pay about 20% more.'
export const FOUNDER_LINE = "I've spent 20 years in education and retraining, and that's why I founded NextChapter."
export const URGENCY = 'For someone out of work, every day matters.'

export interface CopyInput {
  audience: CopyAudience
  mode: CopyMode
  /** The opener arm. */
  arm: AskArm
  /** The close arm; defaults to 'week'. */
  close?: CloseArm
  /** When the email sends, for the 'days' close. Defaults to now. */
  sendAt?: Date
  /** The first name, or 'team'. The greeting becomes a merge tag later. */
  greet: string
  picture: LocalPicture
  /** Unused since v4 (the long-search figure is LONG_SEARCH); kept so callers need not change. */
  bls?: string
  /** The signature block. A leading "Best," is dropped: the note signs off with the first name. */
  signOff: string
  /** Other organizations serving the same people (workforce board only): the board, not us, brings them in (owner, 2026-11-17). */
  partners?: string[]
}

/** "A", "A and B", "A, B and C". */
export const listNames = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

/** The board note's sentence naming the others: "A serves them too", "A and B serve them too". */
export const othersLine = (xs: string[]) => {
  const names = xs.slice(0, 3).map((n) => n.replace(/\s*\([^)]*\.[a-z]{2,}\)\s*$/i, '').trim()).filter(Boolean)
  return names.length ? `${listNames(names)} ${names.length === 1 ? 'serves' : 'serve'} them too, and it works for all of you.` : null
}

const n = (x: number) => x.toLocaleString('en-US')
/** Sentence case: the first letter capitalized, the rest as written (names keep their capitals). */
export const sentence = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)
/** The signature without "Best,": the note itself ends with the first name. */
export const noteSignature = (signOff: string) => signOff.replace(/^Best,\n/, '')

/** What a subject line needs to know about the layoff. */
export interface HeadlineFacts { org: string; employees: number | null; state: string | null; county: string | null; audience: CopyAudience; mode: CopyMode }

/** The one subject per audience (owner, 2026-11-18), in sentence case (owner, 2026-11-19). Facts only: the employer, the headcount and the place. */
export function subjectFor(f: HeadlineFacts): string {
  const org = cleanEmployerName(f.org)
  const N = f.employees ? n(f.employees) : null
  const state = f.state ? (STATE_NAMES[f.state] ?? f.state) : null
  const place = f.county ? `${f.county.replace(/\s+county$/i, '')} County` : state
  const older = f.mode === 'older'
  const who = N ? `the ${N}` : 'the people'
  switch (f.audience) {
    case 'hr': return sentence(`job matching for ${who} ${older ? 'who left' : 'leaving'} ${org}`)
    case 'rapid_response': return sentence(older ? `${org}, a few weeks on` : `before your ${org} meeting`)
    case 'job_center': return sentence(older ? `still helping the people from ${org}` : `if someone from ${org} walks in`)
    default: return sentence(older ? `the ${org} layoff, a few weeks on` : `the ${org} layoff${place ? ` in ${place}` : ''}`)
  }
}

export function outreachCopy(i: CopyInput): { subject: string; body: string } {
  const p = i.picture
  const org = cleanEmployerName(p.employer)
  const N = p.employees ? n(p.employees) : null
  const older = i.mode === 'older'
  const subject = subjectFor({ org: p.employer, employees: p.employees, state: p.state, county: p.county, audience: i.audience, mode: i.mode })
  const name = !i.greet || i.greet === 'team' ? 'team' : i.greet
  const founderFirst = i.arm === 'A'

  const gap = i.audience === 'hr'
    ? 'most outplacement ends long before their search does'
    : i.audience === 'economic_development'
      ? 'the help most laid-off professionals get ends long before their search does'
      : "training programs and caseloads weren't built for searches that long"

  const offer = 'An AI agent runs each person\'s job search, and we retrain them in the AI skills employers now ask for.'
  let middle: string
  let target: string
  if (i.audience === 'hr') {
    middle = `We work alongside your outplacement provider and your own training. An AI agent keeps running each person's job search after the package ends, and we retrain them in the AI skills employers now ask for. ${AI_PAY} That gap is why employers are talking with us.`
    middle = founderFirst ? `I know it was hard to let those people go. ${middle}` : `${FOUNDER_LINE} ${middle}`
    target = `we'd get ${N ? `the ${N}` : 'the people'} ${older ? 'who left' : 'leaving'} ${org} back to work faster, in better jobs`
  } else if (i.audience === 'economic_development') {
    middle = `${founderFirst ? '' : `${FOUNDER_LINE} `}An AI agent matches each person to local openings for as long as they're searching, and we retrain them in the AI skills employers now ask for. ${AI_PAY} That gap is why cities and workforce boards are talking with us.`
    target = `this keeps the people ${older ? `${org} let go` : `leaving ${org}`} working here`
  } else {
    const others = i.audience === 'workforce_board' && i.partners?.length ? othersLine(i.partners) : null
    middle = `${founderFirst ? '' : `${FOUNDER_LINE} `}We work alongside your programs. ${offer} ${AI_PAY} That's why workforce boards are talking with us: it adds capacity without adding work for your team.${others ? ` ${others}` : ''}`
    target = `this could work for ${N ? `the ${N} people` : 'the people'} ${older ? 'who left' : 'leaving'} ${org}`
  }

  const stayLocal = i.audience === 'economic_development' ? ' Every extra month is a month they might spend looking somewhere else.' : ''
  const opening = founderFirst
    ? [`Hi ${name} - I'm Justin, founder of NextChapter. I started it because ${LONG_SEARCH}, and ${gap}.${stayLocal}`]
    : [`Hi ${name} -`, `${i.audience === 'hr' ? 'I know it was hard to let those people go. ' : ''}${sentence(LONG_SEARCH)}, and ${gap}.${stayLocal}`]
  const ask = (i.close ?? 'week') === 'days' ? daysAsk(i.sendAt ?? new Date()) : WEEK_ASK
  const close = `${founderFirst ? 'After 20 years in education and retraining, I' : 'I'}'d like to show you how ${target}. ${URGENCY} ${ask}`

  return { subject, body: [...opening, middle, close, 'Justin', noteSignature(i.signOff)].join('\n\n') }
}

/** The page link with the campaign tags: PostHog reads utm_* on its own, and the landing page reads them to show the HR or partner block. */
export function taggedLink(base: string, o: { audience: CopyAudience; arm: AskArm; noticeId?: string }): string {
  const u = new URL(base)
  u.searchParams.set('utm_source', 'layoff_outreach')
  u.searchParams.set('utm_medium', 'email')
  u.searchParams.set('utm_campaign', o.audience)
  u.searchParams.set('utm_content', o.arm)
  if (o.noticeId) u.searchParams.set('lo_n', o.noticeId)
  return u.toString()
}
