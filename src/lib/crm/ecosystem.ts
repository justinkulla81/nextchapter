import 'server-only'
import { prisma } from '@/lib/prisma'
import { classifyFunctions, industryKeyForNaics, INDUSTRY_KEYS, FUNCTION_KEYS, classifyIndustries } from './coverage'
import { jobBoardIndustryFor } from '@/lib/warn/layoff-picture'

export interface RecruiterRow {
  id: string; name: string; title: string | null; org: string | null; orgId: string | null
  email: string | null; guessed: boolean; phone: string | null; location: string | null
  states: string[]; industries: string[]; functions: string[]; source: string | null
}

/** Recruiters matching any combination of state, industry and function. National recruiters match every state. */
export async function recruiters(f: { state?: string; industry?: string; fn?: string }, take = 200): Promise<{ rows: RecruiterRow[]; total: number }> {
  const where = {
    deletedAt: null, mergedIntoId: null, roles: { has: 'RECRUITER_PROSPECT' as const },
    ...(f.state ? { coverageStates: { hasSome: [f.state, 'NATIONAL'] } } : {}),
    ...(f.industry ? { coverageIndustries: { has: f.industry } } : {}),
    ...(f.fn ? { coverageFunctions: { has: f.fn } } : {}),
  }
  const [people, total] = await Promise.all([
    prisma.crmPerson.findMany({
      where, take, orderBy: [{ coverageSource: 'desc' }, { priorityScore: 'desc' }, { fullName: 'asc' }],
      select: {
        id: true, fullName: true, email: true, emails: true, guessedEmail: true, phone: true, location: true, coverageStates: true, coverageIndustries: true, coverageFunctions: true, coverageSource: true,
        affiliations: { where: { isCurrent: true }, take: 1, select: { title: true, org: { select: { id: true, name: true } } } },
      },
    }),
    prisma.crmPerson.count({ where }),
  ])
  // Local before national, researched before derived, so a state page leads with people who work there.
  const rows = people.map((p) => {
    const email = p.email ?? p.emails[0] ?? null
    return {
      id: p.id, name: p.fullName, title: p.affiliations[0]?.title ?? null, org: p.affiliations[0]?.org.name ?? null, orgId: p.affiliations[0]?.org.id ?? null,
      email: email ?? p.guessedEmail, guessed: !email && !!p.guessedEmail, phone: p.phone, location: p.location,
      states: p.coverageStates, industries: p.coverageIndustries, functions: p.coverageFunctions, source: p.coverageSource,
    }
  })
  if (f.state) rows.sort((a, b) => Number(b.states.includes(f.state!)) - Number(a.states.includes(f.state!)))
  return { rows, total }
}

/** How many recruiters are tagged to each state, industry and function. */
export async function coverageCounts(): Promise<{ states: Record<string, number>; industries: Record<string, number>; functions: Record<string, number>; total: number; untagged: number }> {
  const all = await prisma.crmPerson.findMany({
    where: { deletedAt: null, mergedIntoId: null, roles: { has: 'RECRUITER_PROSPECT' } },
    select: { coverageStates: true, coverageIndustries: true, coverageFunctions: true },
  })
  const out = { states: {} as Record<string, number>, industries: {} as Record<string, number>, functions: {} as Record<string, number>, total: all.length, untagged: 0 }
  for (const p of all) {
    if (!p.coverageStates.length && !p.coverageIndustries.length && !p.coverageFunctions.length) out.untagged++
    for (const s of p.coverageStates) out.states[s] = (out.states[s] ?? 0) + 1
    for (const i of p.coverageIndustries) out.industries[i] = (out.industries[i] ?? 0) + 1
    for (const f of p.coverageFunctions) out.functions[f] = (out.functions[f] ?? 0) + 1
  }
  return out
}

/** The CRM's free-text industry labels that belong to one job-board industry key. */
async function labelsFor(key: string): Promise<string[]> {
  const labels = await prisma.crmOrganization.groupBy({ by: ['industry'], where: { industry: { not: null } }, _count: true })
  return labels.map((l) => l.industry!).filter((l) => (jobBoardIndustryFor(l) ?? classifyIndustries(l)[0]) === key)
}

export async function industryEcosystem(key: string) {
  const since = new Date(Date.now() - 365 * 86_400_000)
  const labels = await labelsFor(key)
  const [employers, employerCount, notices, openings, recs] = await Promise.all([
    prisma.crmOrganization.findMany({
      where: { industry: { in: labels }, NOT: { orgTypes: { has: 'VENDOR' } } }, orderBy: [{ priorityScore: 'desc' }, { name: 'asc' }], take: 25,
      select: { id: true, name: true, usState: true, hqCity: true },
    }),
    prisma.crmOrganization.count({ where: { industry: { in: labels } } }),
    prisma.warnNotice.findMany({ where: { dismissedAt: null, noticeDate: { gte: since }, industry: { not: null } }, select: { id: true, employer: true, state: true, employees: true, industry: true, noticeDate: true }, orderBy: { employees: { sort: 'desc', nulls: 'last' } }, take: 4000 }),
    prisma.companyJobOpening.count({ where: { industry: key, closeReason: null } }).catch(() => 0),
    recruiters({ industry: key }, 60),
  ])
  const layoffs = notices.filter((n) => industryKeyForNaics(n.industry) === key)
  return { labels, employers, employerCount, layoffs: layoffs.slice(0, 25), layoffCount: layoffs.length, layoffWorkers: layoffs.reduce((s, n) => s + (n.employees ?? 0), 0), openings, recruiters: recs }
}

export async function functionEcosystem(key: string) {
  const [recs, firms] = await Promise.all([
    recruiters({ fn: key }, 100),
    prisma.searchFirm.findMany({ where: { sampleTitles: { isEmpty: false } }, select: { id: true, name: true, website: true, segment: true, sampleTitles: true, crmOrgId: true }, take: 1500 }),
  ])
  const matching = firms.filter((f) => f.sampleTitles.some((t) => classifyFunctions(t).includes(key)))
  return { recruiters: recs, firms: matching.slice(0, 40), firmCount: matching.length }
}

export const ALL_INDUSTRY_KEYS = INDUSTRY_KEYS
export const ALL_FUNCTION_KEYS = FUNCTION_KEYS
