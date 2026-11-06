// CSV exports for LinkedIn Matched Audiences: a company list (organizations) and a contact list (people) built from the CRM
// sources for workforce boards, workforce programs, economic development and chambers. Admin-only download at
// https://launchyournextchapter.com/api/admin/linkedin-audiences?list=orgs or ?list=people.
//
// The company list carries no personal data. The contact list uploads named business contacts' emails to an advertiser, so
// the privacy policy sentence "We do not share it with data brokers or advertisers" must be settled before it is uploaded
// (owner decision). The export itself only produces a file.

export const ORG_KINDS = ['WORKFORCE_BOARD', 'WORKFORCE', 'ECON_DEV', 'CHAMBER'] as const
export type OrgKind = (typeof ORG_KINDS)[number]

export interface BoardRow {
  name: string
  website: string | null
  state: string
  directorName: string | null
  directorTitle: string | null
  directorEmail: string | null
  chairName: string | null
  chairEmail: string | null
}

export interface LeadRow {
  name: string
  kind: string
  state: string
  city: string | null
  website: string | null
  contactName: string | null
  contactTitle: string | null
  contactEmail: string | null
}

export interface OrgOut { name: string; website: string; city: string; state: string; kind: OrgKind }
export interface PersonOut { email: string; firstName: string; lastName: string; title: string; company: string; state: string }

const EMAIL = /^[^\s@,"]+@[^\s@,"]+\.[a-z]{2,}$/i
// Shared mailboxes name no one and LinkedIn cannot match them to a profile.
const ROLE_MAILBOX = /^(info|contact|admin|office|hello|help|support|jobs|careers|hr|general|webmaster|reception|enroll|training)@/i

/** A site or address reduced to its domain ("https://www.example.org/jobs" becomes "example.org"). Empty when it is not a real domain. */
export function domainOf(site: string | null | undefined): string {
  const d = String(site ?? '').trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[/?#].*$/, '')
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d) ? d : ''
}

export function splitName(full: string | null | undefined): { first: string; last: string } {
  const parts = String(full ?? '')
    .replace(/\b(dr|mr|mrs|ms|hon)\.?\s+/gi, '')
    .replace(/,.*$/, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length < 2) return { first: '', last: '' }
  return { first: parts[0], last: parts[parts.length - 1] }
}

const key = (name: string, state: string) => `${name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}|${state}`

/** One row per organization, boards first, then leads of the wanted kinds that have a site. */
export function buildOrgRows(boards: BoardRow[], leads: LeadRow[], kinds: readonly OrgKind[] = ORG_KINDS): OrgOut[] {
  const seen = new Set<string>()
  const out: OrgOut[] = []
  const add = (o: OrgOut) => {
    const k = key(o.name, o.state)
    if (!o.name.trim() || seen.has(k)) return
    seen.add(k)
    out.push(o)
  }
  if (kinds.includes('WORKFORCE_BOARD')) {
    for (const b of boards) add({ name: b.name.trim(), website: domainOf(b.website), city: '', state: b.state, kind: 'WORKFORCE_BOARD' })
  }
  for (const l of leads) {
    if (!(kinds as readonly string[]).includes(l.kind)) continue
    const website = domainOf(l.website)
    if (!website) continue // a name alone matches too few LinkedIn pages to be worth the row
    add({ name: l.name.trim(), website, city: l.city ?? '', state: l.state, kind: l.kind as OrgKind })
  }
  return out
}

/** One row per named person with a personal-looking email: board directors and chairs, then researched lead contacts. */
export function buildPeopleRows(boards: BoardRow[], leads: LeadRow[], kinds: readonly OrgKind[] = ORG_KINDS): PersonOut[] {
  const seen = new Set<string>()
  const out: PersonOut[] = []
  const add = (email: string | null, name: string | null, title: string | null, company: string, state: string) => {
    const e = String(email ?? '').trim().toLowerCase()
    if (!EMAIL.test(e) || ROLE_MAILBOX.test(e) || seen.has(e)) return
    const { first, last } = splitName(name)
    if (!first || !last) return
    seen.add(e)
    out.push({ email: e, firstName: first, lastName: last, title: String(title ?? '').trim(), company, state })
  }
  if (kinds.includes('WORKFORCE_BOARD')) {
    for (const b of boards) {
      add(b.directorEmail, b.directorName, b.directorTitle || 'Executive Director', b.name, b.state)
      add(b.chairEmail, b.chairName, 'Board Chair', b.name, b.state)
    }
  }
  for (const l of leads) {
    if ((kinds as readonly string[]).includes(l.kind)) add(l.contactEmail, l.contactName, l.contactTitle, l.name, l.state)
  }
  return out
}

/** LinkedIn's company-list template columns. */
export const ORG_HEADER = ['companyname', 'companywebsite', 'city', 'state', 'country', 'source']
export const orgCsvRows = (rows: OrgOut[]) => rows.map((r) => [r.name, r.website, r.city, r.state, 'US', r.kind])

/** LinkedIn's contact-list template columns. */
export const PEOPLE_HEADER = ['email', 'firstname', 'lastname', 'jobtitle', 'employeecompany', 'country']
export const peopleCsvRows = (rows: PersonOut[]) => rows.map((r) => [r.email, r.firstName, r.lastName, r.title, r.company, 'US'])
