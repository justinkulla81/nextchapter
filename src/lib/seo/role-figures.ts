import 'server-only'
import { unstable_cache } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { heavy } from '@/lib/db/heavy'
import { readBoardFigure } from '@/lib/jobs/stored-board-figures'
import { BASE, PAY, PUBLIC, getTitleIndex, median, newestJobs, percentile, round, type TitleJob, type TitleStat } from '@/lib/seo/job-titles'
import { jobIndustryBucket } from '@/lib/profile/industry-reading'
import { aiSkillItem } from '@/lib/skills/ai-skills'
import { stateName, stateSlug } from '@/lib/seo/states'
import { STATE_NAMES } from '@/lib/workforce/places'
import {
  ROLES, ROLE_JOB_IDS, ROLE_MIN_AI_SAMPLE, ROLE_MIN_INDUSTRY_JOBS, ROLE_MIN_JOBS, ROLE_MIN_PAY, ROLE_MIN_SKILL_SAMPLE, ROLE_MIN_STATE_JOBS,
  roleBySlug, rolesForTitle, type RoleDef,
} from '@/lib/seo/role-pages'

// The figures behind the role pages (/roles/<role>), from the open public job listings: the same rows the job board shows, under
// the same allowlist and pay rules as the title and salary pages (job-titles.ts). One pass reads every listing whose title looks like
// a leadership title, matches each to the roles it counts toward (role-pages.ts), and works out each role's pay, states,
// industries, employers, skills and AI skills in memory. The pass runs in the board-figures cron (refresh-board-figures.ts), which
// stores one row per role; a page reads its stored row, never the scan.

export interface RoleStat {
  slug: string
  jobs: number
  payCount: number
  p25: number | null
  median: number | null
  p75: number | null
}

export interface RoleFigure extends RoleStat {
  jobIds: string[]
  states: { code: string; jobs: number; median: number | null; payCount: number }[]
  industries: { name: string; jobs: number; median: number | null; payCount: number }[]
  /** Listings whose employer has an industry; the denominator for the industry shares. */
  industryKnown: number
  employers: { name: string; jobs: number }[]
  /** The usual cleaned titles under the role (the title pages' own keys), most listings first. */
  titles: { base: string; jobs: number }[]
  /** Skills named in the role's listings, and how many listings name at least one skill (the denominator). */
  skills: { name: string; count: number }[]
  skillSample: number
  /** Listings read from the full posting text, how many of them ask for a specific AI skill, and which ones. */
  ai: { sample: number; withAi: number; items: { id: string; count: number }[] }
  work: { remote: number; hybrid: number; onsite: number }
}

interface ScanRow {
  id: string
  title: string
  b: string
  state: string | null
  company: string
  posted: Date
  pay: number | null
  industry: string | null
  skills: string[] | null
  aiSkillItems: string[] | null
  aiSkillGroups: string[] | null
  aiBasis: string | null
  work: string | null
}

// A cheap filter so only leadership-looking titles leave the database; role-pages.ts decides which role each one is.
const LEADERSHIP = `\\m(chief|c[a-z]{1,3}o|vp|svp|evp|vice president|director|head of|general counsel)\\M`

/** One pass over the open board. Run by the board-figures cron, never by a page. */
async function scan(): Promise<{ index: RoleStat[]; parts: Map<string, RoleFigure> }> {
  const rows = await prisma.$queryRaw<ScanRow[]>`
    SELECT id, title, ${BASE} AS b, "locationState" AS state, "companyName" AS company, COALESCE("postedAt", "createdAt") AS posted, ${PAY}::float8 AS pay,
      industry, skills, "aiSkillItems", "aiSkillGroups", "aiBasis", "workArrangement" AS work
    FROM "ExclusiveJobPosting"
    WHERE ${PUBLIC} AND title ~* ${LEADERSHIP}`
  const byRole = new Map<string, ScanRow[]>()
  for (const r of rows) {
    for (const role of rolesForTitle(r.title)) (byRole.get(role.slug) ?? byRole.set(role.slug, []).get(role.slug)!).push(r)
  }
  const index: RoleStat[] = []
  const parts = new Map<string, RoleFigure>()
  for (const role of ROLES) {
    const list = byRole.get(role.slug) ?? []
    if (list.length < ROLE_MIN_JOBS) continue
    const fig = figureFor(role, list)
    parts.set(role.slug, fig)
    index.push({ slug: fig.slug, jobs: fig.jobs, payCount: fig.payCount, p25: fig.p25, median: fig.median, p75: fig.p75 })
  }
  index.sort((a, b) => b.jobs - a.jobs)
  return { index, parts }
}

const top = <T>(m: Map<string, T>, by: (v: T) => number, n: number) => [...m].sort((a, b) => by(b[1]) - by(a[1])).slice(0, n)

function figureFor(role: RoleDef, list: ScanRow[]): RoleFigure {
  const pays = list.flatMap((r) => (r.pay == null ? [] : [Number(r.pay)])).sort((a, b) => a - b)
  const byState = new Map<string, { jobs: number; pay: number[] }>()
  const byIndustry = new Map<string, { jobs: number; pay: number[] }>()
  const byEmployer = new Map<string, number>()
  const byTitle = new Map<string, number>()
  const bySkill = new Map<string, number>()
  const byAi = new Map<string, number>()
  let industryKnown = 0
  let skillSample = 0
  let aiSample = 0
  let withAi = 0
  const work = { remote: 0, hybrid: 0, onsite: 0 }
  for (const r of list) {
    const pay = r.pay == null ? null : Number(r.pay)
    byEmployer.set(r.company, (byEmployer.get(r.company) ?? 0) + 1)
    byTitle.set(r.b, (byTitle.get(r.b) ?? 0) + 1)
    if (r.state && r.state in STATE_NAMES) {
      const e = byState.get(r.state) ?? { jobs: 0, pay: [] }
      e.jobs++
      if (pay != null) e.pay.push(pay)
      byState.set(r.state, e)
    }
    const bucket = jobIndustryBucket(r.industry)
    if (bucket) {
      industryKnown++
      const e = byIndustry.get(bucket) ?? { jobs: 0, pay: [] }
      e.jobs++
      if (pay != null) e.pay.push(pay)
      byIndustry.set(bucket, e)
    }
    const skills = [...new Set((r.skills ?? []).map((s) => s.trim()).filter(Boolean))]
    if (skills.length > 0) {
      skillSample++
      for (const s of skills) bySkill.set(s, (bySkill.get(s) ?? 0) + 1)
    }
    if (r.aiBasis === 'full' || r.aiBasis === 'twin') {
      aiSample++
      if ((r.aiSkillGroups ?? []).length > 0) withAi++
      for (const id of new Set(r.aiSkillItems ?? [])) byAi.set(id, (byAi.get(id) ?? 0) + 1)
    }
    if (r.work === 'remote') work.remote++
    else if (r.work === 'hybrid') work.hybrid++
    else if (r.work === 'onsite') work.onsite++
  }
  return {
    slug: role.slug,
    jobs: list.length,
    payCount: pays.length,
    p25: pays.length >= ROLE_MIN_PAY ? round(percentile(pays, 0.25)) : null,
    median: pays.length >= ROLE_MIN_PAY ? round(percentile(pays, 0.5)) : null,
    p75: pays.length >= ROLE_MIN_PAY ? round(percentile(pays, 0.75)) : null,
    jobIds: [...list].sort((a, b) => new Date(b.posted).getTime() - new Date(a.posted).getTime()).slice(0, ROLE_JOB_IDS).map((r) => r.id),
    states: top(byState, (v) => v.jobs, 14)
      .filter(([, e]) => e.jobs >= ROLE_MIN_STATE_JOBS)
      .map(([code, e]) => ({ code, jobs: e.jobs, median: e.pay.length >= ROLE_MIN_PAY ? round(median(e.pay)) : null, payCount: e.pay.length })),
    industries: top(byIndustry, (v) => v.jobs, 10)
      .filter(([, e]) => e.jobs >= ROLE_MIN_INDUSTRY_JOBS)
      .map(([name, e]) => ({ name, jobs: e.jobs, median: e.pay.length >= ROLE_MIN_PAY ? round(median(e.pay)) : null, payCount: e.pay.length })),
    industryKnown,
    employers: top(byEmployer, (v) => v, 12).map(([name, jobs]) => ({ name, jobs })),
    titles: top(byTitle, (v) => v, 12).map(([base, jobs]) => ({ base, jobs })),
    skills: top(bySkill, (v) => v, 16).map(([name, count]) => ({ name, count })),
    skillSample,
    ai: { sample: aiSample, withAi, items: top(byAi, (v) => v, 8).map(([id, count]) => ({ id, count })) },
    work,
  }
}

/** Every figure the role pages read, from one scan. */
export async function buildRoleFigures(): Promise<{ index: RoleStat[]; parts: Map<string, RoleFigure> }> {
  return heavy(scan)
}

// ── what a page reads ──

const cachedIndex = unstable_cache(async () => (await readBoardFigure<RoleStat[]>('role-index')) ?? [], ['role-index-v1'], { revalidate: 600 })

/** Every role with enough open listings for a page, most listings first. Empty until the board-figures cron has run. */
export async function getRoleIndex(): Promise<RoleStat[]> {
  return cachedIndex()
}

export interface RoleDetail {
  role: RoleDef
  stat: RoleStat
  figure: RoleFigure
  jobs: TitleJob[]
  states: { code: string; name: string; slug: string; jobs: number; median: number | null }[]
  industries: { name: string; jobs: number; median: number | null; share: number }[]
  /** The cleaned titles under the role that have a job-title page, to link to. */
  titles: TitleStat[]
  skills: { name: string; share: number }[]
  /** Roles in the same function at other levels that have pages. */
  ai: { sample: number; sharePct: number; items: { label: string; share: number }[] } | null
}

/** One role's page data, or null when the role has no page (unknown, or below the listings bar). */
export async function getRoleDetail(slug: string): Promise<RoleDetail | null> {
  const role = roleBySlug(slug)
  if (!role) return null
  const index = await getRoleIndex()
  const stat = index.find((s) => s.slug === slug)
  if (!stat) return null
  const figure = await readBoardFigure<RoleFigure>(`role:${slug}`)
  if (!figure) return null
  const [jobs, titleIndex] = await Promise.all([newestJobs(figure.jobIds, 15), getTitleIndex()])
  const bySlugBase = new Map(titleIndex.map((t) => [t.base, t]))
  const aiOk = figure.ai.sample >= ROLE_MIN_AI_SAMPLE
  return {
    role,
    stat,
    figure,
    jobs,
    states: figure.states.map((s) => ({ code: s.code, name: stateName(s.code), slug: stateSlug(s.code), jobs: s.jobs, median: s.median })),
    industries: figure.industryKnown >= ROLE_MIN_INDUSTRY_JOBS * 2
      ? figure.industries.map((i) => ({ name: i.name, jobs: i.jobs, median: i.median, share: i.jobs / figure.industryKnown }))
      : [],
    titles: figure.titles.flatMap((t) => (bySlugBase.has(t.base) ? [bySlugBase.get(t.base)!] : [])).slice(0, 8),
    skills: figure.skillSample >= ROLE_MIN_SKILL_SAMPLE ? figure.skills.slice(0, 12).map((s) => ({ name: s.name, share: s.count / figure.skillSample })) : [],
    ai: aiOk
      ? {
          sample: figure.ai.sample,
          sharePct: Math.round((100 * figure.ai.withAi) / figure.ai.sample),
          items: figure.ai.items.flatMap((i) => {
            const item = aiSkillItem(i.id)
            return item ? [{ label: item.label, share: i.count / figure.ai.sample }] : []
          }).slice(0, 6),
        }
      : null,
  }
}

export { ROLE_MIN_JOBS }
