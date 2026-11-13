/**
 * Layoff outreach copy v2 (owner, 2026-11-13): short, one number, one link, one ask. Pure, so the words and the ask split are tested.
 * Employer HR, job centers, workforce boards and Rapid Response get these; economic development keeps the older note.
 * The only difference between the two arms of the ask test is the last line.
 */
import { STATE_NAMES } from '@/lib/workforce/places'
import type { LocalPicture } from '@/lib/warn/layoff-picture'

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

const ASK: Record<AskArm, Record<'hr' | 'partner', string>> = {
  A: {
    hr: 'Reply "send it" and I\'ll email you a short note to forward to them, plus the pilot details.',
    partner: 'Reply "send it" and I\'ll email you a short note you can hand to anyone who comes in.',
  },
  B: { hr: 'Worth 15 minutes this week?', partner: 'Worth 15 minutes this week?' },
}

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
  const ask = ASK[i.arm][hr ? 'hr' : 'partner']
  return { subject, body: [hello, first, second, ask, i.signOff].join('\n\n') }
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
