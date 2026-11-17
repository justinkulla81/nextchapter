// Alumni Relations › Alumni data: where a college's alumni work, by function,
// seniority, industry, company size and region, plus founders and the last
// year's moves.
//
// What it can credibly show:
// - Work details come only from alumni who joined NextChapter and share their
//   outcome (SHARE_OUTCOME, on unless they turned it off): their current job
//   (MemberEmployment, with the employer's Company record for industry and
//   size) and their profile (function, industry, metro).
// - Class decade and major come from the roster, for every alum.
// - Every breakdown says how many alumni it covers. Any group under
//   MIN_CELL_SIZE is folded into "Other", so no one is identifiable.
//
// Cost: one aggregate statement per college, cached 10 minutes per instance.
// It returns at most ~150 short rows (a few KB), never member rows.

import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { MIN_CELL_SIZE } from '@/lib/admin/cell-suppression'
import { memoTtl } from '@/lib/db/heavy'

const DAY = 86_400_000

export type Slice = { label: string; n: number }
export type Breakdown = { slices: Slice[]; covered: number; other: number }

export type AlumniData = {
  roster: number
  joined: number
  sharing: number
  function: Breakdown
  seniority: Breakdown
  industry: Breakdown
  size: Breakdown
  region: Breakdown
  founders: number | null
  decade: Breakdown
  major: Breakdown
  moves: { newJobs: number | null; promotions: number | null; layoffMatches: number | null }
}

type Row = { dim: string; value: string | null; n: number }

const SIZE_LABELS: Record<string, string> = {
  MICRO: '1–10 employees',
  SMALL: '11–50',
  SMALL_MID: '51–200',
  MID: '201–1,000',
  MID_LARGE: '1,001–5,000',
  LARGE: '5,001–20,000',
  ENTERPRISE: '20,001–100,000',
  MEGA: '100,000+',
}
const SIZE_ORDER = Object.keys(SIZE_LABELS)
const SENIORITY_ORDER = ['C-Suite', 'VP', 'Director', 'Manager', 'IC']
const SENIORITY_LABELS: Record<string, string> = { 'C-Suite': 'C-suite and partners', VP: 'Vice presidents', Director: 'Directors and heads', Manager: 'Managers', IC: 'Individual contributors' }

const atLeast = (n: number) => (n >= MIN_CELL_SIZE ? n : null)

/** Groups the rows of one dimension: small groups fold into `other`, unknowns are left out of `covered`. Exported for tests. */
export function toBreakdown(rows: Row[], opts: { order?: string[]; labels?: Record<string, string>; limit?: number } = {}): Breakdown {
  const known = rows.filter((r): r is Row & { value: string } => r.value !== null && r.value.trim() !== '')
  const covered = known.reduce((s, r) => s + r.n, 0)
  let shown = known.filter((r) => r.n >= MIN_CELL_SIZE)
  let other = known.filter((r) => r.n < MIN_CELL_SIZE).reduce((s, r) => s + r.n, 0)
  if (opts.order) {
    const rank = (v: string) => {
      const i = opts.order!.indexOf(v)
      return i === -1 ? opts.order!.length : i
    }
    shown.sort((a, b) => rank(a.value) - rank(b.value))
  } else {
    shown.sort((a, b) => b.n - a.n || a.value.localeCompare(b.value))
  }
  if (opts.limit && shown.length > opts.limit) {
    other += shown.slice(opts.limit).reduce((s, r) => s + r.n, 0)
    shown = shown.slice(0, opts.limit)
  }
  return { slices: shown.map((r) => ({ label: opts.labels?.[r.value] ?? r.value, n: r.n })), covered, other }
}

// "Founder", "Co-founder", "Owner", "Founding partner", "Proprietor"; not a
// Scrum "product owner" or a "process owner".
const FOUNDER_TITLE = String.raw`\m(founder|co-?founder|cofounder|owner|founding partner|proprietor)\M`
const NOT_FOUNDER = String.raw`\m(product|process|account|risk|control|data|business process) owner\M`

// When a job has no seniority recorded, read it from the title: a rough SQL
// version of inferLevelFromTitle() (src/lib/jobs/infer-job-function.ts).
const SENIORITY_FROM_TITLE = Prisma.sql`case
  when title is null then null
  when title ~* '\\m(vp|svp|evp|vice president)\\M' then 'VP'
  when title ~* '\\m(chief|president|ceo|cfo|coo|cto|cmo|partner)\\M' and title !~* '\\m(business|channel|account|people|hr) partner' then 'C-Suite'
  when title ~* '\\m(director|head of)\\M' then 'Director'
  when title ~* '\\m(manager|team lead)\\M' then 'Manager'
  else 'IC' end`

async function load(institutionId: string, now: Date): Promise<AlumniData> {
  const from = new Date(now.getTime() - 365 * DAY)
  const rows = await prisma.$queryRaw<Row[]>`
    with base as materialized (
      select m.id, m."candidateId", m."classYear", m.major, m."lastKnownTitle",
        (m."candidateId" is not null and m.status in ('CLAIMED', 'ACTIVE')) as joined
      from public."InstitutionMember" m
      where m."institutionId" = ${institutionId} and m.affiliation in ('ALUM', 'STAFF_ALUM')
    ),
    shared as materialized (
      select emp.function as efn, emp."seniorityBand" as lvl, coalesce(emp.title, b."lastKnownTitle") as title, co.industry, co."sizeBand",
        cp."primaryFunction", cp."industryContext", cp."metroArea", cp."currentState"
      from base b
      join public."CandidateProfile" cp on cp.id = b."candidateId"
      left join lateral (
        select me.function, me."seniorityBand", me.title, me."companyId"
        from public."MemberEmployment" me
        where me."candidateId" = b."candidateId" and me."isCurrent"
        order by me."startDate" desc nulls last
        limit 1
      ) emp on true
      left join public."Company" co on co.id = emp."companyId"
      where b.joined
        and coalesce((
          select c.granted from public."InstitutionConsent" c
          where c."memberId" = b.id and c.scope = 'SHARE_OUTCOME'
          order by c."changedAt" desc, c."createdAt" desc limit 1
        ), true)
    )
    select 'roster' as dim, null as value, count(*)::int as n from base
    union all select 'joined', null, count(*)::int from base where joined
    union all select 'sharing', null, count(*)::int from shared
    union all select 'function', coalesce(efn, "primaryFunction"), count(*)::int from shared group by 2
    union all select 'seniority', coalesce(lvl, ${SENIORITY_FROM_TITLE}), count(*)::int from shared group by 2
    union all select 'industry', coalesce(industry, "industryContext"), count(*)::int from shared group by 2
    union all select 'size', "sizeBand"::text, count(*)::int from shared group by 2
    union all select 'region', coalesce("metroArea", "currentState"), count(*)::int from shared group by 2
    union all select 'founders', null, count(*)::int from shared where title ~* ${FOUNDER_TITLE} and title !~* ${NOT_FOUNDER}
    union all select 'decade', (("classYear" / 10) * 10)::text, count(*)::int from base where "classYear" is not null group by 2
    union all select 'major', min(btrim(major)), count(*)::int from base where major is not null
      group by btrim(regexp_replace(regexp_replace(replace(lower(major), '&', ' and '), '[^a-z0-9 ]', ' ', 'g'), '\\s+', ' ', 'g'))`
  // Counts only: distinct members, computed in the database.
  const [[moves], promotions] = await Promise.all([
    prisma.$queryRaw<{ newJobs: number; layoffs: number }[]>`
      select
        (select count(distinct o."memberId")::int from public."OutcomeReport" o join public."InstitutionMember" m on m.id = o."memberId"
          where m."institutionId" = ${institutionId} and o."reportedAt" >= ${from} and o."reportedAt" <= ${now}) as "newJobs",
        (select count(distinct l."memberId")::int from public."LayoffMatch" l
          where l."institutionId" = ${institutionId} and l."matchedAt" >= ${from} and l."matchedAt" <= ${now}) as layoffs`,
    prisma.prospectFlag.count({ where: { institutionId, type: 'PROMOTION_VP_PLUS', detectedAt: { gte: from, lte: now } } }),
  ])
  const of = (dim: string) => rows.filter((r) => r.dim === dim)
  const one = (dim: string) => of(dim)[0]?.n ?? 0
  return {
    roster: one('roster'),
    joined: one('joined'),
    sharing: one('sharing'),
    function: toBreakdown(of('function'), { limit: 12 }),
    seniority: toBreakdown(of('seniority'), { order: SENIORITY_ORDER, labels: SENIORITY_LABELS }),
    industry: toBreakdown(of('industry'), { limit: 12 }),
    size: toBreakdown(of('size'), { order: SIZE_ORDER, labels: SIZE_LABELS }),
    region: toBreakdown(of('region'), { limit: 12 }),
    founders: atLeast(one('founders')),
    decade: toBreakdown(
      of('decade').map((r) => ({ ...r, value: r.value ? `${r.value}s` : null })),
      { order: of('decade').map((r) => (r.value ? `${r.value}s` : '')).sort() },
    ),
    major: toBreakdown(of('major'), { limit: 15 }),
    moves: { newJobs: atLeast(moves?.newJobs ?? 0), promotions: atLeast(promotions), layoffMatches: atLeast(moves?.layoffs ?? 0) },
  }
}

const cached = memoTtl(10 * 60_000, (institutionId: string) => institutionId, (institutionId: string) => load(institutionId, new Date()))

export function alumniData(institutionId: string): Promise<AlumniData> {
  return cached(institutionId)
}
