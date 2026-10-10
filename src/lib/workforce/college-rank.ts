import 'server-only'
import { prisma } from '@/lib/prisma'
import { boardCountyKeys } from './board-area'
import { isCompanyWide } from './board-report'
import { scoreCollege, type CollegeFacts } from './college-score'
import { contactStrength, strongerContact, type ContactStrength } from '@/lib/crm/contact-strength'
import { strictOrgKey } from '@/lib/crm/normalize'
import { normalizeOrgName } from '@/lib/text/org-name-match'

/** "https://www.washjeff.edu/" → "washjeff.edu"; "https://www.york.cuny.edu" → "york.cuny.edu". */
export function siteDomain(website: string | null): string | null {
  if (!website) return null
  try {
    return new URL(website).hostname.toLowerCase().replace(/^(www\d?|home|web)\./, '')
  } catch { return null }
}

/**
 * Whether an email address is the college's own: its domain is the
 * college's, or a subdomain of it (rdelfine@andrew.cmu.edu at cmu.edu). A
 * system domain shared by many campuses (cuny.edu) is not any one campus's.
 */
export function emailAtCollege(email: string, domain: string): boolean {
  const d = email.split('@')[1]?.toLowerCase().trim()
  return !!d && (d === domain || d.endsWith(`.${domain}`))
}

/** Contacts whose priority says something about a college as a partner — listed, not inferred. */
export const RELATIONSHIP_ROLES = ['ALUMNI_OFFICE', 'HIGHER_ED_DEVELOPMENT', 'HIGHER_ED_CAREER', 'HIGHER_ED_EXEC_ED', 'HIGHER_ED_ADMIN', 'BD_PARTNER'] as const

/** 0 for P0 or a pilot/customer, 1 for P1 or a live deal, 2 for P2 or first contact, 3 for none. */
export function relationshipLevel(points: number): number {
  return points >= 40 ? 0 : points >= 30 ? 1 : points >= 15 ? 2 : 3
}

const PRIORITY_ORDER = ['P0', 'P1', 'P2'] as const
type Priority = (typeof PRIORITY_ORDER)[number]
const better = (a: Priority | null, b: Priority | null): Priority | null =>
  !a ? b : !b ? a : PRIORITY_ORDER.indexOf(a) <= PRIORITY_ORDER.indexOf(b) ? a : b

/**
 * Scores and ranks every college (see college-score.ts), writing score,
 * parts, tier and rank. Re-run weekly so the layoffs around each college
 * stay current; nothing here costs anything.
 */
export async function rankColleges(): Promise<{ ranked: number; tiers: Record<string, number> }> {
  const since = new Date(Date.now() - 365 * 86_400_000)
  const [colleges, contacts, boards, notices, orgs, affiliations, prioritized, factRows, anyAffiliations, eduPersons] = await Promise.all([
    prisma.localCollege.findMany({
      select: {
        id: true, name: true, website: true, crmOrgId: true,
        state: true, countyKey: true, sector: true, carnegie: true, size: true, admitRate: true, interestSignals: true,
      },
    }),
    prisma.collegeContact.findMany({ select: { collegeId: true, role: true, name: true, title: true, email: true } }),
    prisma.workforceBoard.findMany({ select: { id: true, state: true, counties: true, placeCounties: true, statewide: true } }),
    prisma.warnNotice.findMany({
      where: { workforceBoardId: { not: null }, dismissedAt: null, noticeDate: { gte: since } },
      select: { workforceBoardId: true, employees: true, source: true, sourceUrl: true },
    }),
    prisma.crmOrganization.findMany({ select: { id: true, name: true, dealStatus: true } }),
    prisma.crmAffiliation.findMany({
      where: { isCurrent: true, person: { deletedAt: null, priority: { not: null }, roles: { hasSome: [...RELATIONSHIP_ROLES] } } },
      select: { orgId: true, person: { select: { priority: true } } },
    }),
    prisma.crmPerson.findMany({
      where: { deletedAt: null, priority: { not: null }, roles: { hasSome: [...RELATIONSHIP_ROLES] } },
      select: { priority: true, email: true, emails: true },
    }),
    // Facts from scripts/geo/load-colleges.ts; an empty table just leaves scores as they were.
    prisma.$queryRaw<{ unitid: string; alumni: number | null; expenses: number | null; endowment: number | null; privateGifts: number | null; earnings10: number | null; employedShare10: number | null; hasExecEd: boolean | null; hasRetraining: boolean | null }[]>`
      select "unitid", coalesce("alumniReported", "alumniEstimate") as alumni, expenses, endowment, "privateGifts", earnings10, "employedShare10", "hasExecEd", "hasRetraining" from "CollegeProfile"`
      .catch(() => []),
    // Anyone in the CRM at an organization, with how warm: "any contact helps a little, a warm one a lot".
    prisma.crmAffiliation.findMany({
      where: { isCurrent: true, person: { deletedAt: null } },
      select: { orgId: true, person: { select: { warmth: true, connectedAt: true, linkedinDegree: true, firstRepliedAt: true, lastTouchedAt: true, touchCount: true, notes: true } } },
    }),
    // People with a college address, wherever they are affiliated.
    prisma.crmPerson.findMany({
      where: { deletedAt: null, email: { endsWith: '.edu', mode: 'insensitive' } },
      select: { warmth: true, connectedAt: true, linkedinDegree: true, firstRepliedAt: true, lastTouchedAt: true, touchCount: true, notes: true, email: true, emails: true },
    }),
  ])
  const strengthByOrg = new Map<string, ContactStrength>()
  for (const a of anyAffiliations) {
    const st = contactStrength(a.person)
    if (st) strengthByOrg.set(a.orgId, strongerContact(strengthByOrg.get(a.orgId), st)!)
  }
  const eduStrength = eduPersons.map((p) => ({ strength: contactStrength(p), emails: [...new Set([p.email, ...p.emails].filter(Boolean) as string[])] }))
  const strengthAtDomain = (domain: string): ContactStrength | null =>
    eduStrength.reduce<ContactStrength | null>((best, p) => (p.strength && p.emails.some((e) => emailAtCollege(e, domain)) ? strongerContact(best, p.strength) : best), null)
  const facts = new Map<string, CollegeFacts>(factRows.map((r) => [r.unitid, r]))
  // The college's organization in the CRM: the one it is linked to, or one of the same name.
  const orgById = new Map(orgs.map((o) => [o.id, o]))
  const orgByKey = new Map(orgs.map((o) => [strictOrgKey(o.name, normalizeOrgName), o]))
  const bestByOrg = new Map<string, Priority | null>()
  for (const a of affiliations) bestByOrg.set(a.orgId, better(bestByOrg.get(a.orgId) ?? null, a.person.priority as Priority))
  // Anyone prioritized whose address is on a college's own domain works there.
  const eduPeople = prioritized
    .map((p) => ({ priority: p.priority as Priority, emails: [...new Set([p.email, ...p.emails].filter(Boolean) as string[])] }))
    .filter((p) => p.emails.some((e) => /\.edu$/i.test(e.trim())))
  const bestAtDomain = (domain: string): Priority | null =>
    eduPeople.reduce<Priority | null>((best, p) => (p.emails.some((e) => emailAtCollege(e, domain)) ? better(best, p.priority) : best), null)
  // Jobs in state filings per board — company-wide counts are not local.
  const jobsByBoard = new Map<string, number>()
  for (const n of notices) {
    if (isCompanyWide(n)) continue
    jobsByBoard.set(n.workforceBoardId!, (jobsByBoard.get(n.workforceBoardId!) ?? 0) + (n.employees ?? 0))
  }
  const boardsByState = new Map<string, typeof boards>()
  for (const b of boards) boardsByState.set(b.state, [...(boardsByState.get(b.state) ?? []), b])
  const contactsByCollege = new Map<string, typeof contacts>()
  for (const c of contacts) contactsByCollege.set(c.collegeId, [...(contactsByCollege.get(c.collegeId) ?? []), c])

  const scored = colleges.map((c) => {
    const stateBoards = boardsByState.get(c.state) ?? []
    const hasLocal = stateBoards.some((b) => !b.statewide)
    const areaJobsLost = Math.max(0, ...stateBoards
      .filter((b) => {
        const keys = boardCountyKeys(b)
        return keys === 'all' ? !hasLocal : !!c.countyKey && keys.includes(c.countyKey)
      })
      .map((b) => jobsByBoard.get(b.id) ?? 0))
    const org = (c.crmOrgId ? orgById.get(c.crmOrgId) : undefined) ?? orgByKey.get(strictOrgKey(c.name, normalizeOrgName))
    const domain = siteDomain(c.website)
    const relationship = better(org ? bestByOrg.get(org.id) ?? null : null, domain ? bestAtDomain(domain) : null)
    return {
      id: c.id, crmOrgId: org?.id ?? null, relationship,
      ...scoreCollege({ ...c, contacts: contactsByCollege.get(c.id) ?? [], areaJobsLost, relationship, dealStatus: org?.dealStatus ?? null, profile: facts.get(c.id) ?? null,
        contactStrength: strongerContact(org ? strengthByOrg.get(org.id) ?? null : null, domain ? strengthAtDomain(domain) : null) }),
    }
  // Relationships first — a P0 contact or a pilot/customer, then P1 or a live
  // deal, then P2 or first contact — then tier, so a community college held
  // to C never ranks above a four-year B, then score.
  }).sort((a, b) => relationshipLevel(a.parts.relationship) - relationshipLevel(b.parts.relationship) || a.tier.localeCompare(b.tier) || b.score - a.score)

  const now = new Date()
  const tiers: Record<string, number> = {}
  // One statement per 500 colleges rather than one per college.
  for (let i = 0; i < scored.length; i += 500) {
    const chunk = scored.slice(i, i + 500)
    await prisma.$executeRaw`
      UPDATE "LocalCollege" c SET "score" = v.score, "scoreParts" = v.parts::jsonb, "tier" = v.tier, "rank" = v.rank, "scoredAt" = ${now},
        "crmOrgId" = v.org, "relationship" = v.rel
      FROM (SELECT unnest(${chunk.map((s) => s.id)}::text[]) AS id,
                   unnest(${chunk.map((s) => s.score)}::float8[]) AS score,
                   unnest(${chunk.map((s) => JSON.stringify(s.parts))}::text[]) AS parts,
                   unnest(${chunk.map((s) => s.tier)}::text[]) AS tier,
                   unnest(${chunk.map((_, j) => i + j + 1)}::int[]) AS rank,
                   unnest(${chunk.map((s) => s.crmOrgId)}::text[]) AS org,
                   unnest(${chunk.map((s) => s.relationship)}::text[]) AS rel) v
      WHERE c.id = v.id`
  }
  for (const s of scored) tiers[s.tier] = (tiers[s.tier] ?? 0) + 1
  return { ranked: scored.length, tiers }
}
