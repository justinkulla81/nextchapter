/**
 * When a newly filed layoff is worth an email now instead of at the next
 * morning digest, and what that email and the notice's label say. Pure, so
 * the rules are testable without a database or a mail server.
 */
import { costLines, type CostFields } from './layoff-cost'

export const ALERT_MIN_EMPLOYEES = 250

export type LayoffKind = 'news' | 'sec' | 'warn'

/** One person (or one center) to contact about a layoff. */
export interface ContactCard {
  name: string
  title: string | null
  org: string | null
  email: string | null
  /** The address was worked out from a format, not published or verified. */
  guessed?: boolean
  phone: string | null
  /** The person's LinkedIn profile, when we have one (for a firm card, the recruiter to start with). */
  linkedin?: string | null
  /** How warm our relationship is; null for a directory entry nobody has touched. */
  strength: 'hot' | 'warm' | null
  /** Where to open this person (their CRM page, or the center's website). */
  href: string | null
  /** The CRM person this card is, when it is one (not a center or an office); a click on their Write email button is logged on their record. */
  personId?: string
  /** How to greet them in a drafted email: a first name, "Dr. Last", or "team" for a center or office. */
  greet?: string
  /** A Gmail compose link, from justin@launchyournextchapter.com, prefilled with a note written for this person's role. */
  compose?: string | null
  /** The partner's own branded page on our site (workforce board, job center, economic development group), when it has one; and its name. */
  page?: string
  pageName?: string
  /** Which subject-line test arm the drafted note uses ('A', 'B', 'C'), shown beside the button so opens can be compared. */
  variant?: string
}

/** The people in one role around a layoff: the employer's HR head, the state's Rapid Response team, and so on. */
export interface ContactGroup {
  key: string
  label: string
  /** Why this role matters for this layoff, one line. */
  why: string
  cards: ContactCard[]
  /** People in the group beyond the ones shown. */
  more?: number
  moreHref?: string | null
  /** What to do when nobody is on file. */
  emptyHint: string
  /** What to say to this group about this layoff: the openings, industries hiring, retraining. Public partners only. */
  pitch?: string
}

export interface AlertInput {
  employer: string
  employees: number | null
  percent: number | null
  kind: LayoffKind
  confirmed: boolean
  inCrm: boolean
  /** People we know at the company, and how many of them are warm. */
  people: number
  warm: number
  contactsFound: number
  /** Where the layoff is, "Harris County, TX", when the notice says. */
  place?: string | null
  /** Everyone related to the layoff, by role. */
  groups?: ContactGroup[]
  /** What the layoff costs the employer and who runs the outplacement, when known. */
  costs?: Partial<CostFields>
  /** The industry and local job picture, as label/value rows. */
  picture?: { rows: [string, string][] }
}

export function shouldAlert(a: Pick<AlertInput, 'employees' | 'inCrm'>): boolean {
  return (a.employees ?? 0) >= ALERT_MIN_EMPLOYEES || a.inCrm
}

export const sizeLabel = (employees: number | null, percent: number | null): string =>
  employees ? `${employees.toLocaleString('en-US')} jobs` : percent ? `${percent}% of staff` : 'size unknown'

export function alertSubject(a: AlertInput): string {
  return `Layoff alert: ${a.employer} (${sizeLabel(a.employees, a.percent)})${a.inCrm ? ' — in your CRM' : ''}${a.confirmed ? '' : ' — unconfirmed'}`
}

const KIND_LABEL: Record<LayoffKind, string> = {
  news: 'News report', sec: 'SEC 8-K filing', warn: 'WARN filing',
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Email clients ignore most CSS, so the layout is tables and inline styles.
const INK = '#14213D', MUTED = '#55627A', LINE = '#D9E0EA', ACCENT = '#0B7A75', PAPER = '#F6F8FB'
const FONT = "-apple-system,'Segoe UI',Helvetica,Arial,sans-serif"

const link = (href: string | null, text: string, style = '') =>
  href ? `<a href="${esc(href)}" style="color:${ACCENT};${style}">${esc(text)}</a>` : esc(text)

function badge(text: string, fg: string, bg: string): string {
  return `<span style="display:inline-block;font-size:11px;font-weight:600;padding:1px 8px;border-radius:99px;color:${fg};background:${bg}">${esc(text)}</span>`
}

function cardRow(c: ContactCard): string {
  const strength = c.strength === 'hot' ? badge('Hot', '#0B5E59', '#DDF1EF') : c.strength === 'warm' ? badge('Warm', '#9A5B00', '#FFF0D6') : ''
  const sub = [c.title, c.org].filter(Boolean).map((s) => esc(s as string)).join(' · ')
  const email = c.email
    ? `<a href="mailto:${esc(c.email)}" style="color:${ACCENT}">${esc(c.email)}</a>${c.guessed ? ` <span style="color:${MUTED}">(guessed)</span>` : ''}`
    : `<span style="color:${MUTED}">No email yet</span>`
  const linkedin = c.linkedin ? `<div><a href="${esc(c.linkedin)}" style="color:${ACCENT}">LinkedIn</a></div>` : ''
  const compose = c.compose
    ? `<div style="margin-top:6px"><a href="${esc(c.compose)}" style="display:inline-block;padding:4px 10px;background:${ACCENT};border-radius:6px;color:#fff;text-decoration:none;font-size:12px;font-weight:600">Write email</a>${c.variant ? ` <span style="color:${MUTED};font-size:11px">Subject ${esc(c.variant)}</span>` : ''}</div>`
    : ''
  return `<tr>
<td style="padding:10px 12px;border-top:1px solid ${LINE};vertical-align:top"><div style="font-weight:600">${link(c.href, c.name, `color:${INK};text-decoration:none`)} ${strength}</div><div style="color:${MUTED};font-size:13px">${sub}</div></td>
<td style="padding:10px 12px;border-top:1px solid ${LINE};vertical-align:top;font-size:13px;text-align:right">${email}${c.phone ? `<div style="color:${MUTED}">${esc(c.phone)}</div>` : ''}${linkedin}${compose}</td>
</tr>`
}

function groupHtml(g: ContactGroup): string {
  const body = g.cards.length
    ? g.cards.map(cardRow).join('') + (g.more ? `<tr><td colspan="2" style="padding:8px 12px;border-top:1px solid ${LINE};font-size:13px;color:${MUTED}">${g.moreHref ? link(g.moreHref, `and ${g.more} more`) : `and ${g.more} more`}</td></tr>` : '')
    : `<tr><td colspan="2" style="padding:10px 12px;border-top:1px solid ${LINE};font-size:13px;color:${MUTED}">None on file. ${esc(g.emptyHint)}</td></tr>`
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};border-radius:8px;border-collapse:separate;margin:0 0 14px;background:#fff">
<tr><td colspan="2" style="padding:10px 12px;background:${PAPER};border-radius:8px 8px 0 0"><div style="font-weight:600">${esc(g.label)}</div><div style="color:${MUTED};font-size:12px">${esc(g.why)}</div>${g.pitch ? `<div style="margin-top:6px;font-size:13px"><strong>What to say:</strong> ${esc(g.pitch)}</div>` : ''}</td></tr>
${body}
</table>`
}

/** Counts across the groups for the one-line summary above them. */
export function groupSummary(groups: ContactGroup[]): { people: number; withEmail: number; strong: number; covered: number; total: number } {
  const cards = groups.flatMap((g) => g.cards)
  return {
    people: cards.length,
    withEmail: cards.filter((c) => c.email && !c.guessed).length,
    strong: cards.filter((c) => c.strength).length,
    covered: groups.filter((g) => g.cards.length).length,
    total: groups.length,
  }
}

export function alertBody(a: AlertInput, links: { source: string | null; org: string | null; notices: string }): string {
  const facts: [string, string][] = [
    ['Source', esc(KIND_LABEL[a.kind]) + (a.confirmed ? '' : ' — one outlet so far, unconfirmed')],
  ]
  if (a.inCrm) {
    facts.push(['In your CRM', a.people
      ? `${a.people} ${a.people === 1 ? 'person' : 'people'}${a.warm ? `, ${a.warm} warm` : ', none warm'}`
      : 'organization only, no contacts'])
  }
  const { cost, outplacement } = costLines(a.costs ?? {})
  facts.push(['Cost to employer', esc(cost)])
  if (outplacement) facts.push(['Outplacement', esc(outplacement.replace(/^Outplacement: /, ''))])
  if (a.contactsFound) facts.push(['Named contacts found', String(a.contactsFound)])

  const sizeLine = [
    esc(sizeLabel(a.employees, a.percent)) + (a.employees && a.percent ? ` (${a.percent}% of staff)` : ''),
    a.place ? esc(a.place) : '',
  ].filter(Boolean).join(' · ')

  const buttons = [
    links.source ? `<a href="${esc(links.source)}" style="display:inline-block;padding:7px 14px;border:1px solid ${LINE};border-radius:6px;color:${INK};text-decoration:none;font-size:13px;margin:0 6px 6px 0">Source</a>` : '',
    links.org ? `<a href="${esc(links.org)}" style="display:inline-block;padding:7px 14px;background:${ACCENT};border-radius:6px;color:#fff;text-decoration:none;font-size:13px;margin:0 6px 6px 0">Open in CRM</a>` : '',
    `<a href="${esc(links.notices)}" style="display:inline-block;padding:7px 14px;border:1px solid ${LINE};border-radius:6px;color:${INK};text-decoration:none;font-size:13px;margin:0 6px 6px 0">All layoff notices</a>`,
  ].join('')

  const picture = a.picture?.rows.length
    ? `<h2 style="font:600 18px/1.3 Georgia,'Times New Roman',serif;margin:22px 0 6px">Local picture</h2>
<table role="presentation" cellpadding="3" style="border-collapse:collapse;margin:0 0 6px">${a.picture.rows.map(([k, v]) => `<tr><td style="color:${MUTED};padding-right:14px;vertical-align:top">${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>`
    : ''

  let who = ''
  if (a.groups?.length) {
    const s = groupSummary(a.groups)
    who = `<h2 style="font:600 18px/1.3 Georgia,'Times New Roman',serif;margin:26px 0 4px">Who to contact</h2>
<p style="margin:0 0 14px;color:${MUTED};font-size:13px">${s.people} ${s.people === 1 ? 'person' : 'people'} across ${s.covered} of ${s.total} groups · ${s.withEmail} with a verified or published email · ${s.strong} with a relationship</p>
${a.groups.map(groupHtml).join('')}`
  }

  return `<div style="max-width:640px;margin:0 auto;font:14px/1.5 ${FONT};color:${INK}">
<p style="margin:0;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:${ACCENT};font-weight:600">Layoff alert</p>
<h1 style="font:600 26px/1.2 Georgia,'Times New Roman',serif;margin:4px 0 4px">${esc(a.employer)}</h1>
<p style="margin:0 0 14px;color:${MUTED}">${sizeLine}</p>
<table role="presentation" cellpadding="3" style="border-collapse:collapse;margin:0 0 12px">${facts.map(([k, v]) => `<tr><td style="color:${MUTED};padding-right:14px">${k}</td><td>${v}</td></tr>`).join('')}</table>
<div>${buttons}</div>
${picture}
${who}
<p style="color:${MUTED};font-size:13px;margin-top:18px">Primary contact is settled in the 7 AM run, warm lead first.</p>
</div>`
}

/** The notice's label: how many outlets, and the share of staff when the text gave one. */
export function layoffTypeLabel(o: { publishers: number; publisher: string | null; percent: number | null }): string {
  const base = o.publishers >= 2
    ? `Reported by ${o.publishers} publishers`
    : `Reported by 1 publisher (${o.publisher ?? 'unknown'}) — unconfirmed`
  return o.percent ? `${base} · ${o.percent}% of staff` : base
}


/** Groups with a person we can email first, then groups with people but no address, then empty ones. Keeps the order within each. */
export function orderGroups<T extends { cards: { email: string | null; guessed?: boolean }[] }>(groups: T[]): T[] {
  const rank = (g: T) => (g.cards.some((c) => c.email && !c.guessed) ? 0 : g.cards.length ? 1 : 2)
  return groups.map((g, i) => ({ g, i })).sort((a, b) => rank(a.g) - rank(b.g) || a.i - b.i).map((x) => x.g)
}


/** An alert still short of contacts after this long is dropped, not emailed. */
export const ALERT_HOLD_HOURS = 72

const EMPLOYER_GROUPS = ['head_hr', 'hr_team']
const PUBLIC_GROUPS = ['rapid_response', 'workforce_board', 'job_centers', 'economic_development']

/**
 * Whether an alert is worth emailing yet. Justin only wants the email once it is
 * populated: where the layoff is, an HR contact with an email address (a guessed
 * one counts, an empty "none on file" does not), and at least two of the public
 * partners (state Rapid Response, the workforce board, American Job Centers,
 * economic development). Anything missing is returned so the hold can say why.
 */
export function alertReadiness(groups: ContactGroup[], state: string | null): { ready: boolean; missing: string[] } {
  const missing: string[] = []
  if (!state) missing.push('where the layoff is (no state known)')
  if (!groups.some((g) => EMPLOYER_GROUPS.includes(g.key) && g.cards.some((c) => !!c.email))) missing.push('an HR contact with an email address')
  const publicFilled = groups.filter((g) => PUBLIC_GROUPS.includes(g.key) && g.cards.length > 0).length
  if (publicFilled < 2) missing.push(`public-sector contacts (${publicFilled} of 4 groups; need two)`)
  return { ready: missing.length === 0, missing }
}
