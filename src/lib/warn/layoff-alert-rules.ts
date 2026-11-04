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
  /** The division of the employer the layoff is in, when the filing or coverage names one. */
  division?: string | null
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
  /** Every page that reported the layoff: the filing, each news story. */
  sources?: AlertSource[]
  /** What the alert could not fill in before it was sent (no state, no HR email); shown at the top so a thin email is not mistaken for a finished one. */
  gaps?: string[]
}

export interface AlertSource { label: string; url: string }

/** The notice's own link first, then the rest, one entry per address. Only http(s) links are kept. */
export function mergeSources(primary: AlertSource | null, rest: AlertSource[] = []): AlertSource[] {
  const seen = new Set<string>()
  return [...(primary ? [primary] : []), ...rest].filter((s) => {
    const key = s.url.trim().replace(/\/$/, '')
    if (!/^https?:\/\//i.test(key) || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * What kind of record a notice is. layoffs.fyi rows are stored as WARN_FILING but are press reports, not state filings,
 * so a layoffs.fyi link makes it 'news' (and unconfirmed) whatever the source column says.
 */
export function noticeKind(n: { source: string; sourceUrl: string | null; layoffType?: string | null }): LayoffKind {
  if (/layoffs\.fyi/i.test(n.sourceUrl ?? '')) return 'news'
  if (n.source === 'WARN_FILING') return 'warn'
  return /sec\.gov/i.test(n.sourceUrl ?? '') || /^SEC 8-K/i.test(n.layoffType ?? '') ? 'sec' : 'news'
}

export function shouldAlert(a: Pick<AlertInput, 'employees' | 'inCrm'>): boolean {
  return (a.employees ?? 0) >= ALERT_MIN_EMPLOYEES || a.inCrm
}

export const sizeLabel = (employees: number | null, percent: number | null): string =>
  employees ? `${employees.toLocaleString('en-US')} jobs` : percent ? `${percent}% of staff` : 'size unknown'

export function alertSubject(a: AlertInput): string {
  return `Layoff alert: ${a.employer}${a.division ? ` — ${a.division} division` : ''} (${sizeLabel(a.employees, a.percent)})${a.inCrm ? ' — in your CRM' : ''}${a.confirmed ? '' : ' — unconfirmed'}`
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

export function alertBody(a: AlertInput, links: { source: string | null; org: string | null; notices: string; noticePage?: string | null; linkedin?: string | null }): string {
  const facts: [string, string][] = [
    ...(a.division ? [['Division', esc(a.division)] as [string, string]] : []),
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

  const gapNote = a.gaps?.length
    ? `<p style="margin:0 0 14px;padding:10px 12px;background:#FFF0D6;border-radius:8px;color:#7A4A00;font-size:13px"><strong>Sent before it was fully researched.</strong> Missing: ${a.gaps.map(esc).join('; ')}.</p>`
    : ''

  const sources = mergeSources(links.source ? { label: KIND_LABEL[a.kind], url: links.source } : null, a.sources)
  const sourceList = sources.length
    ? `<p style="margin:0 0 4px;color:${MUTED};font-size:12px;text-transform:uppercase;letter-spacing:.06em;font-weight:600">${sources.length === 1 ? 'Source' : `Sources (${sources.length})`}</p>
<ul style="margin:0 0 14px;padding-left:18px;font-size:13px">${sources.map((x) => `<li style="margin:0 0 3px"><a href="${esc(x.url)}" style="color:${ACCENT}">${esc(x.label)}</a></li>`).join('')}</ul>`
    : ''

  const buttons = [
    links.org ? `<a href="${esc(links.org)}" style="display:inline-block;padding:7px 14px;background:${ACCENT};border-radius:6px;color:#fff;text-decoration:none;font-size:13px;margin:0 6px 6px 0">Open in CRM</a>` : '',
    links.noticePage ? `<a href="${esc(links.noticePage)}" style="display:inline-block;padding:7px 14px;border:1px solid ${LINE};border-radius:6px;color:${INK};text-decoration:none;font-size:13px;margin:0 6px 6px 0">Notice page</a>` : '',
    `<a href="${esc(links.notices)}" style="display:inline-block;padding:7px 14px;border:1px solid ${LINE};border-radius:6px;color:${INK};text-decoration:none;font-size:13px;margin:0 6px 6px 0">All layoff notices</a>`,
  ].join('')

  const linkedinBlock = links.linkedin
    ? `<p style="margin:10px 0 4px;color:${MUTED};font-size:12px;text-transform:uppercase;letter-spacing:.06em;font-weight:600">LinkedIn message</p>
<div style="margin:0 0 14px;padding:10px 12px;border:1px solid ${LINE};border-radius:8px;font-size:13px;white-space:pre-wrap">${esc(links.linkedin)}</div>`
    : ''

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
<h1 style="font:600 26px/1.2 Georgia,'Times New Roman',serif;margin:4px 0 4px">${esc(a.employer)}${a.division ? ` <span style="font-size:18px;color:${MUTED}">· ${esc(a.division)} division</span>` : ''}</h1>
<p style="margin:0 0 14px;color:${MUTED}">${sizeLine}</p>
${gapNote}
<table role="presentation" cellpadding="3" style="border-collapse:collapse;margin:0 0 12px">${facts.map(([k, v]) => `<tr><td style="color:${MUTED};padding-right:14px">${k}</td><td>${v}</td></tr>`).join('')}</table>
${sourceList}
<div>${buttons}</div>
${linkedinBlock}
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


/** An alert short of contacts waits this long (retried hourly), then is emailed anyway with the gaps listed; it is never dropped. */
export const ALERT_HOLD_HOURS = 6

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


/** A run emails this many full alerts (contacts, drafted notes); the rest of its layoffs go out together in one digest. */
export const MAX_FULL_ALERTS_PER_RUN = 3

/** One layoff in a digest: enough to decide which to open, with a link to its CRM page for the rest. */
export interface DigestItem {
  employer: string
  employees: number | null
  percent: number | null
  kind: LayoffKind
  confirmed: boolean
  inCrm: boolean
  people: number
  warm: number
  orgUrl: string | null
}

export function digestSubject(items: Pick<DigestItem, 'employer'>[]): string {
  const names = items.slice(0, 3).map((i) => i.employer).join(', ')
  const rest = items.length - 3
  return `${items.length} more layoff ${items.length === 1 ? 'alert' : 'alerts'}: ${names}${rest > 0 ? ` and ${rest} more` : ''}`
}

export function digestBody(items: DigestItem[], links: { notices: string }): string {
  const rows = items.map((i) => {
    const source = KIND_LABEL[i.kind] + (i.confirmed ? '' : ' (unconfirmed)')
    const crm = i.inCrm ? (i.people ? `${i.people} ${i.people === 1 ? 'person' : 'people'}${i.warm ? `, ${i.warm} warm` : ', none warm'}` : 'organization only') : 'not in CRM'
    return `<tr><td style="padding:6px 12px 6px 0;border-top:1px solid ${LINE}">${link(i.orgUrl, i.employer, 'font-weight:600')}</td><td style="padding:6px 12px 6px 0;border-top:1px solid ${LINE};white-space:nowrap">${esc(sizeLabel(i.employees, i.percent))}</td><td style="padding:6px 12px 6px 0;border-top:1px solid ${LINE}">${esc(source)}</td><td style="padding:6px 0;border-top:1px solid ${LINE}">${esc(crm)}</td></tr>`
  }).join('')
  return `<div style="max-width:640px;margin:0 auto;font:14px/1.5 ${FONT};color:${INK}">
<p style="margin:0;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:${ACCENT};font-weight:600">Layoff alerts, one email</p>
<h1 style="font:600 24px/1.2 Georgia,'Times New Roman',serif;margin:4px 0 8px">${items.length} more ${items.length === 1 ? 'layoff' : 'layoffs'}</h1>
<p style="margin:0 0 14px;color:${MUTED}">A run sends the first ${MAX_FULL_ALERTS_PER_RUN} in full and lists the rest here. Each CRM page has who to contact; the 7 AM run settles the primary contact.</p>
<table role="presentation" cellpadding="0" style="border-collapse:collapse;width:100%;font-size:13px">${rows}</table>
<p style="margin:16px 0 0"><a href="${esc(links.notices)}" style="display:inline-block;padding:7px 14px;border:1px solid ${LINE};border-radius:6px;color:${INK};text-decoration:none;font-size:13px">All layoff notices</a></p>
</div>`
}

/** A news-reported layoff that an official filing (state WARN notice or SEC 8-K) has now confirmed. */
export interface OfficialItem {
  employer: string
  kind: 'warn' | 'sec'
  state: string | null
  /** Jobs the filing names, when it names a number; a state notice covers one site, so this can be below the reported total. */
  filingEmployees: number | null
  reportedEmployees: number | null
  effectiveOn: string | null
  sourceUrl: string | null
  orgUrl: string | null
}

export const officialLabel = (kind: 'warn' | 'sec') => (kind === 'sec' ? 'SEC 8-K filing' : 'state WARN filing')

export function officialSubject(items: Pick<OfficialItem, 'employer' | 'kind'>[]): string {
  if (items.length === 1) return `Now official: ${items[0].employer} — ${officialLabel(items[0].kind)}`
  return `Now official: ${items.length} layoffs confirmed by filings — ${items.slice(0, 3).map((i) => i.employer).join(', ')}${items.length > 3 ? ` and ${items.length - 3} more` : ''}`
}

export function officialBody(items: OfficialItem[], links: { notices: string }): string {
  const cards = items.map((i) => {
    const jobs = i.filingEmployees != null ? `${i.filingEmployees.toLocaleString('en-US')} jobs in the filing` : 'no job count in the filing'
    const reported = i.reportedEmployees != null && i.reportedEmployees !== i.filingEmployees ? ` · reported total ${i.reportedEmployees.toLocaleString('en-US')}` : ''
    const bits = [esc(officialLabel(i.kind)), i.state ? esc(i.state) : '', esc(jobs) + reported, i.effectiveOn ? `effective ${esc(i.effectiveOn)}` : ''].filter(Boolean).join(' · ')
    return `<div style="margin:0 0 14px;padding:12px 14px;border:1px solid ${LINE};border-radius:8px;background:${PAPER}">
<p style="margin:0;font:600 17px/1.3 Georgia,'Times New Roman',serif">${link(i.orgUrl, i.employer)}</p>
<p style="margin:2px 0 0;color:${MUTED};font-size:13px">${bits}</p>
${i.sourceUrl ? `<p style="margin:6px 0 0;font-size:13px">${link(i.sourceUrl, 'Open the filing')}</p>` : ''}
</div>`
  }).join('')
  return `<div style="max-width:640px;margin:0 auto;font:14px/1.5 ${FONT};color:${INK}">
<p style="margin:0;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:${ACCENT};font-weight:600">Now official</p>
<h1 style="font:600 24px/1.2 Georgia,'Times New Roman',serif;margin:4px 0 8px">${items.length === 1 ? 'A reported layoff is confirmed' : `${items.length} reported layoffs are confirmed`}</h1>
<p style="margin:0 0 14px;color:${MUTED}">We already had ${items.length === 1 ? 'this one' : 'these'} from news reports. The filing is now on the same record, which is marked confirmed.</p>
${cards}
<p style="margin:0"><a href="${esc(links.notices)}" style="display:inline-block;padding:7px 14px;border:1px solid ${LINE};border-radius:6px;color:${INK};text-decoration:none;font-size:13px">All layoff notices</a></p>
</div>`
}
