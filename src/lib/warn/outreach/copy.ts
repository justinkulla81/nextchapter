/**
 * Layoff outreach copy v2 (owner, 2026-11-13): short, one number, one link, one ask. Pure, so the words and the ask split are tested.
 * Employer HR, job centers, workforce boards and Rapid Response get these; economic development keeps the older note.
 * The only difference between the two arms of the ask test is the last line. One subject per audience (owner, 2026-11-18: the eight
 * backfill headline styles split 136 sends too thin to read; the audience's own line is the one subject now).
 */
import { STATE_NAMES } from '@/lib/workforce/places'
import type { LocalPicture } from '@/lib/warn/layoff-picture'
import { cleanEmployerName } from './employer-name'

export type CopyAudience = 'hr' | 'job_center' | 'workforce_board' | 'rapid_response'
export type CopyMode = 'new' | 'older'
export type AskArm = 'A' | 'B'

/** The list is judged in one pool: HR + job centers + workforce boards. Rapid Response (about 36 addresses) is too small to test and gets the call. */
export function askArm(email: string, audience: CopyAudience): AskArm {
  if (audience === 'rapid_response') return 'B'
  let h = 0
  for (const ch of email.trim().toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h % 2 === 0 ? 'A' : 'B'
}

/**
 * The ask test (owner, 2026-11-18): A is a yes/no referral question, the easiest cold email to answer; B is the call. The first test
 * (A was 'Reply "send it"') got no replies in either arm from the first 136 sends. Every audience gets the same two lines.
 */
export const referralAsk = (org: string) => `Are you the right person to talk to about the ${org} layoff, or should I send this to someone else?`
export const CALL_ASK = 'Worth 15 minutes this week?'
const askLine = (arm: AskArm, org: string) => (arm === 'A' ? referralAsk(org) : CALL_ASK)

export interface CopyInput {
  audience: CopyAudience
  mode: CopyMode
  arm: AskArm
  /** The first name, or 'team'. The greeting becomes a merge tag later. */
  greet: string
  /** The page for the people leaving, already tagged. */
  link: string
  picture: LocalPicture
  /** The long-term unemployment line, e.g. "27.6% of unemployed Americans have been looking for 27 weeks or longer (BLS, October)". */
  bls: string
  signOff: string
  /** Other organizations serving the same people (workforce board only): the board, not us, brings them in (owner, 2026-11-17). */
  partners?: string[]
}

/** "A", "A and B", "A, B and C". */
export const listNames = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

/** The board note's sentence naming the others: "A serves them too", "A and B serve them too". */
export const othersLine = (xs: string[]) => {
  const names = xs.slice(0, 3).map((n) => n.replace(/\s*\([^)]*\.[a-z]{2,}\)\s*$/i, '').trim()).filter(Boolean)
  return names.length ? `${listNames(names)} ${names.length === 1 ? 'serves' : 'serve'} them too; the same page works for all of you.` : null
}

const n = (x: number) => x.toLocaleString('en-US')

export function outreachCopy(i: CopyInput): { subject: string; body: string } {
  const p = i.picture
  const org = p.employer
  const state = p.state ? (STATE_NAMES[p.state] ?? p.state) : null
  const people = p.employees ? `${n(p.employees)} people` : 'people'
  const the = p.employees ? `the ${n(p.employees)}` : 'the people'
  const county = p.county ? `${p.county.replace(/\s+county$/i, '')} County` : null
  const open = p.openInState != null && state ? `${n(p.openInState)} professional roles are open in ${state}` : null
  const hello = !i.greet || i.greet === 'team' ? 'Hi team,' : `${i.greet},`
  const older = i.mode === 'older'
  const hr = i.audience === 'hr'

  let subject: string
  let first: string
  let second: string
  if (hr) {
    subject = older ? `${the} who left ${org}` : `${people} leaving ${org}`
    first = older
      ? `${org}'s layoff${p.employees ? ` of ${n(p.employees)}` : ''} was a few weeks ago. By now the first wave of support is winding down and the search is the hard part: ${i.bls}.`
      : `${org} is letting ${people} go${state ? ` in ${state}` : ''}. ${open ? `${open} today, so there is somewhere to land, and the hard part is finding the roles that fit.` : 'The hard part of the search is finding the roles that fit.'}`
    second = older
      ? `Here is a free page where each person adds their email and gets${open && state ? ` the ${n(p.openInState!)} professional roles open in ${state}` : ' open roles'} matched to their background: ${i.link}. Forward it as is, or we set up 10 seats at no charge and you see counts, never names.`
      : `Here is a free page where each person adds their email and gets roles matched to their background: ${i.link}. Forward it as is, or we set up 10 seats at no charge and you see counts of who used it, never names.`
  } else {
    const where = county ? ` in ${county}` : ''
    if (i.audience === 'rapid_response') subject = older ? `${org}, a few weeks on` : `before your ${org} meeting`
    else if (i.audience === 'job_center') subject = older ? `still helping ${the} from ${org}` : `if someone from ${org} walks in`
    else subject = older ? `${org}'s ${p.employees ? n(p.employees) : 'layoff'}, a few weeks on` : `${org}'s ${p.employees ? `${n(p.employees)}, ` : ''}in ${county ?? state ?? 'your region'}`
    first = older
      ? `It has been a few weeks since ${org} announced ${p.employees ? `${n(p.employees)} layoffs` : 'layoffs'}${where}. The people still searching now are the ones the first round of help did not place: ${i.bls}.`
      : i.audience === 'rapid_response'
        ? `${org}: ${people}${state ? `, ${state}` : ''}. ${open ? `${open} right now.` : ''}`.trim()
        : `${org} is letting ${people} go${where}, and some of them may come to you. ${open ? `${open} right now.` : ''}`.trim()
    second = i.audience === 'rapid_response' && !older
      ? `For your employer meeting, here is a free page for them. Each person adds their email and gets roles matched to the work they did at ${org}: ${i.link}.`
      : `This is a free page for them. Each person adds their email and gets${older && open ? ` the ${n(p.openInState!)} professional roles open in ${state}` : ' roles'} matched to the work they did at ${org}: ${i.link}. Hand it out as is.`
  }
  const ask = askLine(i.arm, org)
  // The board hears first and convenes the rest: name who else serves these people, so the board can bring them in.
  const others = i.audience === 'workforce_board' && i.partners?.length ? othersLine(i.partners) : null
  return { subject, body: [hello, first, others ? `${second} ${others}` : second, ask, i.signOff].join('\n\n') }
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

/** What a headline needs to know about the layoff. */
export interface HeadlineFacts { org: string; employees: number | null; state: string | null; county: string | null; audience: CopyAudience | 'economic_development'; mode: CopyMode }

export const HEADLINE_CODES = ['n1', 'q1', 'loc', 'pg', 'aud', 'quick', 'plain', 'num2'] as const
export type HeadlineCode = (typeof HEADLINE_CODES)[number]

/**
 * The subject lines the backfill tests (owner, 2026-11-13: a different headline each day). Eight styles, two a day: n1 the number first,
 * q1 a question, loc where they can land, pg a page for them, aud the audience's own line (what the live emails use), quick a short
 * personal line, plain the bare fact, num2 the number and the employer. Facts only: the employer, the headcount and the place.
 */
export function headlineFor(code: HeadlineCode, f: HeadlineFacts): string {
  const org = cleanEmployerName(f.org)
  const N = f.employees ? n(f.employees) : null
  const state = f.state ? (STATE_NAMES[f.state] ?? f.state) : null
  const place = f.county ? `${f.county.replace(/\s+county$/i, '')} County` : state
  const older = f.mode === 'older'
  switch (code) {
    case 'n1': return N ? `${N} people ${older ? 'who left' : 'leaving'} ${org}` : `people ${older ? 'who left' : 'leaving'} ${org}`
    case 'q1': return N ? `who is helping ${org}'s ${N}?` : `who is helping the people leaving ${org}?`
    case 'loc': return place ? `where ${org}'s ${N ?? 'people'} can land in ${place}` : `where ${org}'s ${N ?? 'people'} can land`
    case 'pg': return N ? `a page for ${org}'s ${N}` : `a page for the people leaving ${org}`
    case 'aud':
      if (f.audience === 'rapid_response') return older ? `${org}, a few weeks on` : `before your ${org} meeting`
      if (f.audience === 'job_center') return older ? `still helping the people from ${org}` : `if someone from ${org} walks in`
      if (f.audience === 'hr') return older ? `${N ? `the ${N}` : 'the people'} who left ${org}` : `${N ? `${N} people` : 'people'} leaving ${org}`
      return older ? `${org}'s ${N ?? 'layoff'}, a few weeks on` : `${org}'s ${N ? `${N}, ` : ''}in ${place ?? 'your region'}`
    case 'quick': return `${org}: quick question`
    case 'plain': return `${org} layoff`
    case 'num2': return N ? `${N} jobs, ${org}` : `jobs ending at ${org}`
  }
}
