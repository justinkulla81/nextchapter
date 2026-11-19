/**
 * Layoff outreach copy v3 (owner, 2026-11-19, after v2's 200 sends to 13-19 November drew no reply and no human visit; every page view
 * came from a mail scanner). One offer (free job matching for the people leaving), no statistic aimed at someone else, no link in the
 * first email: the reply is the only action, so a scanner cannot fake it, and a link-free first note lands in the inbox more often. The
 * page link goes back in the owner's reply. Subjects are sentence case. Pure, so the words and the ask split are tested.
 * Employer HR, job centers, workforce boards, economic development and Rapid Response all get these.
 */
import { STATE_NAMES } from '@/lib/workforce/places'
import type { LocalPicture } from '@/lib/warn/layoff-picture'
import { cleanEmployerName } from './employer-name'

export type CopyAudience = 'hr' | 'job_center' | 'workforce_board' | 'economic_development' | 'rapid_response'
export type CopyMode = 'new' | 'older'
export type AskArm = 'A' | 'B'

/** The list is judged in one pool. Rapid Response (about 36 addresses) is too small to test and gets the call. */
export function askArm(email: string, audience: CopyAudience): AskArm {
  if (audience === 'rapid_response') return 'B'
  let h = 0
  for (const ch of email.trim().toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h % 2 === 0 ? 'A' : 'B'
}

/**
 * The ask test (v3): A offers the link, a yes that costs the reader nothing; B is the call. v2's A (a referral question) and B both drew
 * no replies in 200 sends.
 */
export const LINK_ASK = 'Want the link to pass along to them?'
export const CALL_ASK = 'Worth 15 minutes this week?'
const askLine = (arm: AskArm) => (arm === 'A' ? LINK_ASK : CALL_ASK)

export interface CopyInput {
  audience: CopyAudience
  mode: CopyMode
  arm: AskArm
  /** The first name, or 'team'. The greeting becomes a merge tag later. */
  greet: string
  picture: LocalPicture
  /** The long-term unemployment line, e.g. "27.6% of unemployed Americans have been looking for 27 weeks or longer (BLS, October)". Partners' older note only. */
  bls: string
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
  const state = p.state ? (STATE_NAMES[p.state] ?? p.state) : null
  const county = p.county ? `${p.county.replace(/\s+county$/i, '')} County` : null
  const where = county ?? state
  const N = p.employees ? n(p.employees) : null
  const older = i.mode === 'older'
  const hello = !i.greet || i.greet === 'team' ? 'Hi team,' : `Hi ${i.greet} -`
  const roles = `open professional roles${state ? ` in ${state}` : ''}`
  const subject = subjectFor({ org: p.employer, employees: p.employees, state: p.state, county: p.county, audience: i.audience, mode: i.mode })

  const paras: string[] = []
  if (i.audience === 'hr') {
    const who = `the ${N ? `${N} ` : ''}people ${older ? 'who left' : 'leaving'} ${org}`
    paras.push(`NextChapter can give ${who} free job matching. Each person adds their email and gets ${roles} matched to their background.`)
    paras.push(`There is no cost to them or to ${org}, and nothing for your team to run.`)
  } else if (i.audience === 'rapid_response' && !older) {
    paras.push(`For your ${org} employer meeting: NextChapter can give the ${N ? `${N} ` : ''}people leaving free job matching. Each person adds their email and gets ${roles} matched to the work they did there.`)
  } else {
    paras.push(older
      ? `It has been a few weeks since ${org} announced ${N ? `${N} layoffs` : 'layoffs'}${county ? ` in ${county}` : ''}. The people still searching now are the ones the first round of help did not place: ${i.bls}.`
      : `${org} is letting ${N ? `${N} people` : 'people'} go${where ? ` in ${where}` : ''}${i.audience === 'job_center' ? ', and some of them may come to you' : ''}.`)
    const others = i.audience === 'workforce_board' && i.partners?.length ? othersLine(i.partners) : null
    paras.push(`NextChapter can give each of them free job matching: they add their email and get ${roles} matched to the work they did at ${org}. You can hand it out as is.${others ? ` ${others}` : ''}`)
  }
  return { subject, body: [hello, ...paras, askLine(i.arm), 'Justin', noteSignature(i.signOff)].join('\n\n') }
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
