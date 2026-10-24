import 'server-only'
import { prisma } from '@/lib/prisma'
import { contactStrength } from '@/lib/crm/contact-strength'
import { isHrLeaderTitle } from '@/lib/crm/org-domains'
import { pickBoard } from '@/lib/workforce/match'
import { cityFromAddress } from '@/lib/workforce/places'
import { industryName, recruiterFit } from '@/lib/crm/coverage'
import { orderGroups, type ContactCard, type ContactGroup } from './layoff-alert-rules'

const SITE = 'https://launchyournextchapter.com'
/** Cards shown per group, the people worth a call or email; the rest are counted and linked. */
const SHOWN = 3
const SHOWN_BY_GROUP: Record<string, number> = { head_hr: 2, hr_team: 3, rapid_response: 2, workforce_board: 2, job_centers: 2, economic_development: 3, employer_other: 2, recruiters: 4 }
/** Notes written by scripts/crm/rapid-response-import.ts on each state coordinator. */
const RAPID_RESPONSE_NOTE = 'State Rapid Response Coordinators page'
/** The rest of an HR department, by title: rewards, relations, talent, partners, learning. */
const HR_TEAM = /human resources|\bhr\b|people (operations|partner|team|&|and culture)|total rewards|compensation|benefits|employee relations|labor relations|talent|recruit|workforce|learning/i
/** Economic development groups and chambers, by organization name. */
const ECON_NAMES = ['economic development', 'chamber', 'development authority', 'development council', 'development corporation']

const personSelect = {
  id: true, fullName: true, email: true, emails: true, guessedEmail: true, phone: true, roles: true,
  warmth: true, connectedAt: true, linkedinDegree: true, firstRepliedAt: true, lastTouchedAt: true, touchCount: true, notes: true,
} as const
type PersonRow = {
  id: string; fullName: string; email: string | null; emails: string[]; guessedEmail: string | null; phone: string | null; roles: string[]
  warmth: string; connectedAt: Date | null; linkedinDegree: string | null; firstRepliedAt: Date | null; lastTouchedAt: Date | null; touchCount: number; notes: string | null
}

function card(p: PersonRow, title: string | null, org: string | null): ContactCard {
  const email = p.email ?? p.emails[0] ?? null
  const s = contactStrength(p)
  return {
    name: p.fullName, title, org,
    email: email ?? p.guessedEmail, guessed: !email && !!p.guessedEmail,
    phone: p.phone, strength: s === 'hot' || s === 'warm' ? s : null,
    href: `${SITE}/support/admin/crm/people/${p.id}`,
  }
}

const rank = (c: ContactCard) => (c.strength === 'hot' ? 0 : c.strength === 'warm' ? 1 : 2) * 2 + (c.email && !c.guessed ? 0 : 1)
const best = (cards: ContactCard[]) => [...cards].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))

function group(key: string, label: string, why: string, emptyHint: string, all: ContactCard[], moreHref: string | null = null): ContactGroup {
  const sorted = best(all)
  return { key, label, why, emptyHint, cards: sorted.slice(0, SHOWN_BY_GROUP[key] ?? SHOWN), more: Math.max(0, sorted.length - (SHOWN_BY_GROUP[key] ?? SHOWN)) || undefined, moreHref }
}

export interface LayoffPlace {
  state: string | null
  county: string | null
  /** A city found from the coverage or the company's filings, when the notice has no address. */
  city?: string | null
  address: string | null
  workforceBoardId: string | null
  /** The layoff's industry as a job-board key (src/lib/crm/coverage.ts), when known. */
  industryKey?: string | null
}

/**
 * Everyone we have who is tied to one layoff, by role: the employer's head of HR, the rest of
 * its HR and outplacement buyers, the state Rapid Response coordinator, the local workforce
 * board, the American Job Centers near it, and economic development groups in the state.
 * Reads only what is already in the CRM and the workforce tables.
 */
export async function layoffPeople(orgId: string | null, place: LayoffPlace): Promise<{ groups: ContactGroup[]; placeLabel: string | null }> {
  const orgHref = orgId ? `${SITE}/support/admin/crm/organizations/${orgId}` : null

  const affiliations = orgId
    ? await prisma.crmAffiliation.findMany({
        where: { orgId, isCurrent: true, person: { deletedAt: null, mergedIntoId: null } },
        select: { title: true, org: { select: { name: true } }, person: { select: personSelect } },
        take: 80,
      })
    : []
  const head: ContactCard[] = [], hrTeam: ContactCard[] = [], others: ContactCard[] = []
  for (const a of affiliations) {
    const c = card(a.person, a.title, a.org.name)
    const buyer = a.person.roles.some((r) => r === 'OUTPLACEMENT_BUYER' || r === 'LEARNING_DEV_HEAD' || r === 'CHRO')
    if (isHrLeaderTitle(a.title)) head.push(c)
    else if (buyer || (a.title && HR_TEAM.test(a.title))) hrTeam.push(c)
    else others.push(c)
  }

  const state = place.state
  const rapid = state
    ? await prisma.crmPerson.findMany({
        where: { deletedAt: null, mergedIntoId: null, notes: { contains: RAPID_RESPONSE_NOTE }, affiliations: { some: { isCurrent: true, org: { usState: state } } } },
        select: { ...personSelect, affiliations: { where: { isCurrent: true }, select: { title: true, org: { select: { name: true } } }, take: 1 } },
        take: 8,
      })
    : []

  let board = place.workforceBoardId ? await prisma.workforceBoard.findUnique({ where: { id: place.workforceBoardId } }) : null
  if (!board && state && (place.county || place.address || place.city)) {
    const boards = await prisma.workforceBoard.findMany({ where: { state } })
    board = pickBoard(boards, place.county, place.city ?? cityFromAddress(place.address, state))
  }
  const boardCards: ContactCard[] = board
    ? [
        { n: board.directorName, t: board.directorTitle || 'Executive Director', e: board.directorEmail, p: board.directorPhone },
        { n: board.chairName, t: 'Board Chair', e: board.chairEmail, p: board.chairPhone },
      ].filter((x) => x.n && x.n.trim().split(/\s+/).length >= 2).map((x) => ({
        name: x.n!.trim(), title: x.t, org: board!.name, email: x.e || null, phone: x.p || null, strength: null,
        href: board!.website || `${SITE}/support/admin/crm/workforce-boards/${board!.id}`,
      }))
    : []
  // The American Job Centers the board oversees: comprehensive first, and the business-services inbox (the employer-facing contact) before the general one.
  const centers = board
    ? await prisma.americanJobCenter.findMany({ where: { workforceBoardId: board.id }, orderBy: [{ centerType: 'asc' }, { name: 'asc' }], take: 12 })
    : []
  const centerCards: ContactCard[] = centers
    .sort((a, b) => Number(b.centerType === 'Comprehensive') - Number(a.centerType === 'Comprehensive'))
    .map((c) => ({
      name: c.name, title: c.businessEmail ? `${c.centerType ?? 'American Job'} center, business services` : `${c.centerType ?? 'American Job'} center`,
      org: [c.street, c.city].filter(Boolean).join(', ') || null,
      email: c.businessEmail || c.generalEmail || null, phone: c.phone, strength: null, href: c.detailsUrl,
    }))

  const econ = state
    ? await prisma.crmPerson.findMany({
        where: {
          deletedAt: null, mergedIntoId: null,
          affiliations: {
            some: {
              isCurrent: true,
              org: { usState: state, orgTypes: { has: 'GOVERNMENT' }, OR: ECON_NAMES.map((n) => ({ name: { contains: n, mode: 'insensitive' as const } })), NOT: { name: { contains: 'workforce', mode: 'insensitive' } } },
            },
          },
        },
        select: { ...personSelect, affiliations: { where: { isCurrent: true }, select: { title: true, org: { select: { name: true } } }, take: 1 } },
        take: 8,
      })
    : []

  // Recruiters who cover the layoff's state (or are national) and, ranked first, its industry: the people who can place the laid-off.
  const recruiterRows = state
    ? await prisma.crmPerson.findMany({
        where: { deletedAt: null, mergedIntoId: null, roles: { has: 'RECRUITER_PROSPECT' }, recruiterKind: 'recruiter', coverageStates: { hasSome: [state, 'NATIONAL'] } },
        select: { ...personSelect, coverageStates: true, coverageIndustries: true, coverageFunctions: true, recruiterModels: true, affiliations: { where: { isCurrent: true }, select: { title: true, org: { select: { id: true, name: true } } }, take: 1 } },
        take: 1500,
      })
    : []
  // One card per firm: the firm, how many of its recruiters fit, and the best one to contact first. Firms rank by their best recruiter's fit.
  const fitted = recruiterRows
    .map((p) => ({ p, fit: recruiterFit({ states: p.coverageStates, industries: p.coverageIndustries, functions: p.coverageFunctions }, { state, industry: place.industryKey ?? null }) + (p.recruiterModels.includes('candidate_rep') ? 2 : 0) }))
    .filter((x) => x.fit > 0)
  const byFirm = new Map<string, typeof fitted>()
  for (const x of fitted) {
    const key = x.p.affiliations[0]?.org.id ?? `solo:${x.p.id}`
    byFirm.set(key, [...(byFirm.get(key) ?? []), x])
  }
  const reachable = (p: PersonRow) => Number(!!(p.email ?? p.emails[0]))
  const recruiterCards: ContactCard[] = [...byFirm.entries()]
    .map(([key, people]) => {
      const sorted = [...people].sort((a, b) => b.fit - a.fit || reachable(b.p) - reachable(a.p) || a.p.fullName.localeCompare(b.p.fullName))
      return { key, people: sorted, score: sorted[0].fit + Math.min(sorted.length, 5) * 0.1 }
    })
    .sort((a, b) => b.score - a.score)
    .map(({ key, people }) => {
      const lead = people[0].p
      const aff = lead.affiliations[0]
      const c = card(lead, aff?.title ?? null, aff?.org.name ?? null)
      const industries = [...new Set(people.flatMap((x) => x.p.coverageIndustries))].slice(0, 2).map(industryName)
      const local = people.some((x) => x.p.coverageStates.includes(state!))
      const others = people.slice(1, 3).map((x) => x.p.fullName)
      const solo = key.startsWith('solo:')
      return {
        ...c,
        name: solo ? lead.fullName : aff!.org.name,
        title: [`${people.length} ${people.length === 1 ? 'recruiter' : 'recruiters'}`, local ? state : 'national', ...industries].filter(Boolean).join(' · '),
        org: `${solo ? '' : 'Start with '}${solo ? (aff?.title ?? '') : `${lead.fullName}${aff?.title ? `, ${aff.title}` : ''}`}${others.length ? `. Also ${others.join(', ')}${people.length > 3 ? ` and ${people.length - 3} more` : ''}` : ''}`.trim() || null,
        href: solo ? c.href : `${SITE}/support/admin/crm/organizations/${aff!.org.id}`,
      }
    })

  // Chambers, economic development and workforce nonprofits in the layoff's county (the geography lead list).
  const county =place.county?.replace(/\s+county$/i, '').trim() || null
  const geo = state && county
    ? await prisma.geoOrgLead.findMany({
        where: { state, dismissedAt: null, geoArea: { name: { startsWith: county, mode: 'insensitive' } } },
        orderBy: [{ fitScore: { sort: 'desc', nulls: 'last' } }, { revenue: { sort: 'desc', nulls: 'last' } }],
        take: 40,
      })
    : []
  const KIND = { CHAMBER: 'Chamber of commerce', ECON_DEV: 'Economic development', WORKFORCE: 'Workforce group' } as Record<string, string>
  const geoCards: ContactCard[] = geo.map((l) => ({
    name: l.contactName ?? l.name,
    title: l.contactName ? (l.contactTitle ?? KIND[l.kind] ?? l.kind) : (KIND[l.kind] ?? l.kind),
    org: l.contactName ? l.name : l.city,
    email: l.contactEmail, phone: l.contactPhone, strength: null, href: l.website,
  }))
  // People we know come first, then named contacts, then the organizations with no contact yet.
  const econCards = [...econ.map((p) => card(p, p.affiliations[0]?.title ?? null, p.affiliations[0]?.org.name ?? null)), ...geoCards]

  const groups: ContactGroup[] = [
    group('head_hr', 'Head of HR', 'Signs off on severance and vendors. Start here.', 'Run the HR finder for this employer.', head, orgHref),
    group('hr_team', 'Other HR and outplacement buyers', 'Total rewards, employee relations, talent acquisition, HR partners.', 'Hunter domain search with the HR filter finds these.', hrTeam, orgHref),
    group('rapid_response', `State Rapid Response${state ? ` (${state})` : ''}`, 'Meets the employer within days and offers state services.', 'Add the state coordinator from the Department of Labor directory.', rapid.map((p) => card(p, p.affiliations[0]?.title ?? 'Rapid Response contact', p.affiliations[0]?.org.name ?? null))),
    group('workforce_board', board ? `Local workforce board: ${board.name}` : 'Local workforce board', 'Funds dislocated-worker services in the area and joins the Rapid Response meeting.', 'No board matched this notice yet.', boardCards),
    group('job_centers', 'American Job Centers nearby', 'Where laid-off people walk in. The business-services inbox is the employer-facing contact.', 'No centers listed for this board.', centerCards),
    // Ranked by fit already (state first, then industry), so the strongest recruiter leads regardless of relationship strength.
    { ...group('recruiters', `Recruiters${state ? ` covering ${state}` : ''}${place.industryKey ? ` in ${industryName(place.industryKey)}` : ''}`, 'Firms that place the laid-off, each with the recruiter to contact first. Local firms first, then national firms that work this industry.', 'Add recruiters for this state and industry on the Recruiters page.', recruiterCards, `${SITE}/support/admin/crm/recruiters${state ? `?state=${state}${place.industryKey ? `&industry=${place.industryKey}` : ''}` : ''}`), cards: recruiterCards.slice(0, SHOWN_BY_GROUP.recruiters), more: Math.max(0, recruiterCards.length - SHOWN_BY_GROUP.recruiters) || undefined },
    group('economic_development', `Economic development, chambers and workforce groups${county ? ` in ${county} County` : state ? ` in ${state}` : ''}`, 'Local relationships and some incentive money. Organizations without a named contact are listed by name and website.', 'Add the local development group.', econCards),
  ]
  if (others.length) {
    // A big employer has many people we know; show the closest few and count the rest.
    const g = group('employer_other', 'Others at the company', 'People we know who are not in HR.', '', others, orgHref)
    const shown = g.cards.slice(0, 3)
    groups.splice(2, 0, { ...g, cards: shown, more: others.length - shown.length || undefined })
  }

  const placeLabel = [place.county, state].filter(Boolean).join(', ') || null
  return { groups: orderGroups(groups), placeLabel }
}
