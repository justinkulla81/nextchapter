/**
 * Layoff outreach: who gets an email about a layoff and what it says. Pure (no database, no mail server), so the rules are
 * testable on their own. The notes themselves are the ones the layoff alert already drafts for each role
 * (src/lib/warn/layoff-alert-drafts.ts, "we are selling", Justin 2026-10-28); this adds the value paragraph and turns the
 * plain text into the email the mailing tool sends.
 */
import { ALONGSIDE, SIGN_OFF, draftFor, draftKind, type DraftContext } from '@/lib/warn/layoff-alert-drafts'
import type { ContactCard, ContactGroup } from '@/lib/warn/layoff-alert-rules'

export const CAMPAIGN = 'layoff_outreach'

export type OutreachAudience = 'outplacement' | 'rapid_response' | 'workforce_board' | 'job_center' | 'economic_development'

export const AUDIENCE_LABEL: Record<OutreachAudience, string> = {
  outplacement: 'Employer HR (outplacement)',
  rapid_response: 'Rapid Response',
  workforce_board: 'Workforce board',
  job_center: 'American Job Center',
  economic_development: 'Economic development and chambers',
}

/** Who each contact group is, for the campaign. A group not listed here (recruiters, other employees) is not emailed. */
const AUDIENCE_OF_GROUP: Record<string, OutreachAudience> = {
  head_hr: 'outplacement',
  hr_team: 'outplacement',
  rapid_response: 'rapid_response',
  workforce_board: 'workforce_board',
  job_centers: 'job_center',
  economic_development: 'economic_development',
}
/** The order a layoff's emails are claimed in when one address sits in two groups. */
const GROUP_ORDER = ['head_hr', 'hr_team', 'rapid_response', 'workforce_board', 'job_centers', 'economic_development']

/** An address that got a layoff email in this many days gets no other (a state coordinator hears about many layoffs a week). */
export const CONTACT_COOLDOWN_DAYS = 7

/** The national picture the value paragraph opens on. Update with each BLS Employment Situation release. */
export const BLS_NOW = { month: 'October', pct: '27.6', url: 'https://www.bls.gov/news.release/empsit.htm' }

const BLS = `${BLS_NOW.pct}% of unemployed Americans had been looking for work for 27 weeks or longer in ${BLS_NOW.month} (BLS: ${BLS_NOW.url})`

/** The value paragraph that goes in front of "we sit alongside": the problem, what the person gets, what the reader gets. */
export function valueParagraph(audience: OutreachAudience): string {
  if (audience === 'outplacement') {
    return `Whatever you have arranged for the people leaving ends on a date, and ${BLS}. We cover the gap: everyone leaving can start today, free, with local jobs first and the AI skills their best-fit employers ask for. You add paid services, like coaching, for the people you choose, and you see counts, never names. We will set up a pilot of up to 10 seats at no charge: https://launchyournextchapter.com/outplacement`
  }
  return `Programs end, and searches often do not: ${BLS}. Every person you send gets a free place to run theirs, with local jobs first, the AI skills their best-fit employers ask for, and a job search built around their skills. You get the page to use today and the counts, how many signed up and how many stayed in your region, never who.`
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** A line of plain text as HTML: escaped, with each web address a link (and the sentence's own punctuation left outside it). */
function linkify(line: string): string {
  return esc(line).replace(/https:\/\/[^\s<]+/g, (m) => {
    const trail = m.match(/[.,;:)]+$/)?.[0] ?? ''
    const url = trail ? m.slice(0, -trail.length) : m
    return `<a href="${url}">${url}</a>${trail}`
  })
}

/** The note's plain text as the email body: a paragraph per block, the sign-off as the grey signature block. */
export function bodyToHtml(body: string): string {
  return body
    .split('\n\n')
    .map((block) => {
      if (block === SIGN_OFF) return `<div data-signature>${block.split('\n').map(linkify).join('<br>')}</div>`
      return `<p>${block.split('\n').map(linkify).join('<br>')}</p>`
    })
    .join('')
}

/** A first name in a greeting becomes the merge tag, so one email serves everyone who would get the same words. */
function withGreetingMerge(body: string, greet: string | undefined): string {
  if (!greet || !/^[A-Z][a-z'’-]+$/.test(greet)) return body
  return body.startsWith(`${greet},`) ? `Hi {{firstName}},${body.slice(greet.length + 1)}` : body
}

export interface PlannedEmail {
  audience: OutreachAudience
  subject: string
  variant: string | null
  bodyHtml: string
  recipients: { email: string; personId: string | null; name: string }[]
}

export interface PlanOptions {
  /** Addresses that must not be emailed: suppressed, marked do not email, or emailed about another layoff lately. */
  blocked: Set<string>
  /** Addresses of ours (the owner's), never emailed as a contact. */
  ownAddresses?: Set<string>
}

const validEmail = (e: string | null | undefined) => (e && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(e.trim()) ? e.trim().toLowerCase() : null)

/**
 * The emails for one layoff: a note per contact written for their role, grouped so people who would read the same words share
 * one edition (the subject test arm is part of the words). A guessed address is never emailed, one address is emailed once, and
 * an address in `blocked` is left out.
 */
export function planOutreach(groups: ContactGroup[], ctx: DraftContext, opts: PlanOptions): PlannedEmail[] {
  const seen = new Set<string>([...opts.blocked, ...(opts.ownAddresses ?? [])])
  const ordered = [...groups].sort((a, b) => GROUP_ORDER.indexOf(a.key) - GROUP_ORDER.indexOf(b.key))
  const out = new Map<string, PlannedEmail>()
  for (const g of ordered) {
    const audience = AUDIENCE_OF_GROUP[g.key]
    if (!audience) continue
    for (const c of g.cards as ContactCard[]) {
      const email = validEmail(c.email)
      if (!email || c.guessed || seen.has(email)) continue
      const kind = draftKind(g.key, c.title)
      if (!kind || kind === 'other_employee' || kind === 'recruiters') continue
      const draft = draftFor(kind, c, ctx)
      if (!draft.body.includes(ALONGSIDE)) continue
      const body = withGreetingMerge(draft.body.replace(ALONGSIDE, `${valueParagraph(audience)}\n\n${ALONGSIDE}`), c.greet)
      seen.add(email)
      const key = `${audience}|${draft.subject}|${body}`
      const plan = out.get(key) ?? { audience, subject: draft.subject, variant: draft.variant ?? null, bodyHtml: bodyToHtml(body), recipients: [] }
      plan.recipients.push({ email, personId: c.personId ?? null, name: c.name })
      out.set(key, plan)
    }
  }
  return [...out.values()]
}
