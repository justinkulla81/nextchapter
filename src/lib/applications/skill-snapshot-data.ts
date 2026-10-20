import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { skillTerms } from '@/lib/profile/skill-matrix'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { readStoredLinks } from '@/lib/jobs/application-posting-link'
import { occupationForRoleText } from '@/lib/careers/candidate-occupation'
import { getTaxonomy } from '@/lib/careers/taxonomy'
import { inferFunctionFromTitle } from '@/lib/jobs/infer-job-function'
import { classifyTitleRung } from '@/lib/jobs/job-seniority'
import { statesFromLocation } from '@/lib/pay/market-pay'
import { JOB_INDUSTRY_KEY_BUCKET } from '@/lib/profile/industry-reading'
import { AI_FUNCTION_STATS } from '@/lib/skills/ai-skill-market.data'
import { functionCode } from '@/lib/skills/ai-skill-market'
import { CRAWLER_FUNCTION_LABEL } from '@/lib/jobs/job-functions'
import {
  buildSnapshot,
  censusRegion,
  allAsks,
  inferredAsks,
  matchAsks,
  occupationAsksFromPostings,
  postingAsks,
  shouldReplaceSnapshot,
  skillsHash,
  type SkillAsks,
  type SnapshotDraft,
} from './skill-snapshot'
import { summarizeApplications, type ApplicationGapSummary, type SnapshotRow } from './skill-gap-summary'
import { buildSkillMatchReport, pitchGapLine, type AggregateRow, type PitchGapLine, type SkillMatchReport } from './skill-match-aggregate'
import type { PayLift } from './skill-recommend'
export { courseForSkill } from './skill-course'

// Database side of application skill snapshots (skill-snapshot.ts has the rules). Snapshots are taken
// when an application is recorded or linked to a board posting (application-posting-link.ts calls
// snapshotApplication after it stores a link), backfilled by scripts/backfill-application-skill-snapshots.ts,
// and their "current" match is recomputed lazily whenever a member's skills hash changes. Every
// read here is fail-soft: a page must never break because this did.

const SKILL_PROFILE_SELECT = { id: true, resumeKeywords: true, confirmedSkillsHave: true, certifications: true, skillLevels: true } as const

type SkillProfile = { resumeKeywords: string[]; confirmedSkillsHave: string[]; certifications: string[]; skillLevels: unknown }
export const memberKeywordsOf = (p: SkillProfile) => skillTerms(p)

const BUCKET_TO_KEY = new Map(Object.entries(JOB_INDUSTRY_KEY_BUCKET).map(([k, v]) => [v.toLowerCase(), k]))
/** A directory industry label ("Healthcare & Hospital Systems") -> the board's key ("healthcare") when there is one. */
const industryKey = (label: string | null | undefined) => (label ? (BUCKET_TO_KEY.get(label.toLowerCase()) ?? label) : null)

const APP_SELECT = { id: true, candidateId: true, title: true, companyName: true, location: true, appliedAt: true, createdAt: true } as const
type AppRow = { id: string; candidateId: string; title: string | null; companyName: string | null; location: string | null; appliedAt: Date | null; createdAt: Date }

const POSTING_SELECT = {
  id: true, skills: true, aiSkillItems: true, aiToolsNamed: true, industry: true, targetFunction: true, subFunction: true,
  level: true, locationState: true, locationStates: true, employerSector: true, socCode: true, socTitle: true, title: true,
} as const

// ── Inferred asks for an occupation ──

const OCCUPATION_TTL_MS = 60 * 60 * 1000
type OccupationBoard = { asks: SkillAsks | null; jobFunction: string | null }
const occupationMemo = new Map<string, { at: number; value: OccupationBoard }>()

/**
 * What an occupation's open board postings ask for most (indexed on socCode), and the function most
 * of them are in (for a title the function rules can't read); remembered for an hour.
 */
async function occupationBoard(socCode: string): Promise<OccupationBoard> {
  const hit = occupationMemo.get(socCode)
  if (hit && Date.now() - hit.at < OCCUPATION_TTL_MS) return hit.value
  const postings = await prisma.exclusiveJobPosting.findMany({
    where: { socCode, archivedAt: null },
    select: { skills: true, aiSkillItems: true, targetFunction: true },
    orderBy: { createdAt: 'desc' },
    take: 2000,
  })
  const fnCount = new Map<string, number>()
  for (const p of postings) if (p.targetFunction) fnCount.set(p.targetFunction, (fnCount.get(p.targetFunction) ?? 0) + 1)
  const topFn = [...fnCount.entries()].sort((a, b) => b[1] - a[1])[0]
  // A clear majority only: an occupation split across functions names none.
  const value = { asks: occupationAsksFromPostings(postings), jobFunction: topFn && topFn[1] >= 0.5 * postings.length ? topFn[0] : null }
  occupationMemo.set(socCode, { at: Date.now(), value })
  return value
}

// Strips a location / pay / pipe tail: "Director, M&A and Strategy - NYC (Hybrid)" -> "director, m&a and strategy".
const coreTitle = (t: string) => t.split(/\s+[|–—]\s+|\s+-\s+/)[0].replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()

/** The O*NET occupation the crawler gave board postings with the same title, most common first. One scan for a batch. */
async function socFromBoardTitles(titles: string[]): Promise<Map<string, { socCode: string; socTitle: string | null }>> {
  const out = new Map<string, { socCode: string; socTitle: string | null }>()
  const keys = [...new Set(titles.map(coreTitle).filter((t) => t.length >= 4))]
  if (keys.length === 0) return out
  const rows = await prisma.$queryRaw<{ t: string; socCode: string; socTitle: string | null; n: number }[]>`
    SELECT lower(title) AS t, "socCode", max("socTitle") AS "socTitle", count(*)::int AS n FROM "ExclusiveJobPosting"
    WHERE lower(title) = ANY(${keys}) AND "socCode" IS NOT NULL
    GROUP BY 1, 2 ORDER BY 1, 4 DESC`
  for (const r of rows) if (!out.has(r.t)) out.set(r.t, { socCode: r.socCode, socTitle: r.socTitle })
  return out
}

/**
 * Snapshots for these applied applications. Uses each one's stored board link (or `links`, when the
 * caller just computed them), the linked posting, and the member's skills now. Writes only rows that
 * are new or should be replaced (shouldReplaceSnapshot); returns how many of each basis were written.
 */
export async function snapshotApplications(
  appIds: string[],
  links?: Map<string, { postingId: string | null }>,
  opts: { rebuildInferred?: boolean } = {},
): Promise<{ posting: number; inferred: number; skipped: number }> {
  const out = { posting: 0, inferred: 0, skipped: 0 }
  if (appIds.length === 0) return out
  const apps: AppRow[] = await prisma.jobPosting.findMany({ where: { id: { in: appIds }, appliedAt: { not: null } }, select: APP_SELECT })
  if (apps.length === 0) return out
  const stored = links ?? (await readStoredLinks(apps.map((a) => a.id)))
  const postingIds = [...new Set(apps.map((a) => stored.get(a.id)?.postingId).filter((x): x is string => !!x))]
  const candidateIds = [...new Set(apps.map((a) => a.candidateId))]
  const [postings, profiles, existing] = await Promise.all([
    postingIds.length ? prisma.exclusiveJobPosting.findMany({ where: { id: { in: postingIds } }, select: POSTING_SELECT }) : [],
    prisma.candidateProfile.findMany({ where: { id: { in: candidateIds } }, select: SKILL_PROFILE_SELECT }),
    prisma.applicationSkillSnapshot.findMany({ where: { jobPostingId: { in: apps.map((a) => a.id) } }, select: { jobPostingId: true, basis: true, boardJobId: true } }),
  ])
  const postingById = new Map(postings.map((p) => [p.id, p]))
  const keywordsByMember = new Map(profiles.map((p) => [p.id, memberKeywordsOf(p)]))
  const existingByApp = new Map(existing.map((e) => [e.jobPostingId, e]))

  // Inferred snapshots need the O*NET taxonomy and the employer's directory industry.
  const needInferred = apps.filter((a) => {
    const pid = stored.get(a.id)?.postingId
    return !(pid && postingById.has(pid)) && a.title?.trim()
  })
  const [taxonomy, boardSocs] = needInferred.length
    ? await Promise.all([getTaxonomy(), socFromBoardTitles(needInferred.map((a) => a.title!))])
    : [null, new Map<string, { socCode: string; socTitle: string | null }>()]
  const companyIndustry = new Map<string, string | null>()
  if (needInferred.length) {
    const norms = [...new Set(needInferred.map((a) => normalizeOrgName(a.companyName ?? '')).filter(Boolean))]
    if (norms.length) {
      const cos = await prisma.company.findMany({ where: { canonicalNameNormalized: { in: norms } }, select: { canonicalNameNormalized: true, industry: true } })
      for (const c of cos) companyIndustry.set(c.canonicalNameNormalized, c.industry)
    }
  }

  for (const app of apps) {
    try {
      const keywords = keywordsByMember.get(app.candidateId) ?? []
      const pid = stored.get(app.id)?.postingId ?? null
      const posting = pid ? postingById.get(pid) : undefined
      let draft: SnapshotDraft | null = null
      if (posting) {
        draft = buildSnapshot({
          basis: 'posting',
          boardJobId: posting.id,
          socCode: posting.socCode,
          socTitle: posting.socTitle,
          asks: postingAsks(posting),
          facts: {
            industry: posting.industry,
            jobFunction: posting.targetFunction,
            subFunction: posting.subFunction,
            level: posting.level,
            locationState: posting.locationState ?? posting.locationStates[0] ?? statesFromLocation(app.location).states[0] ?? null,
            employerSector: posting.employerSector,
          },
          memberKeywords: keywords,
        })
      } else if (app.title?.trim()) {
        // The title's O*NET occupation: the taxonomy's own title match, else what the crawler gave board postings with this title.
        const own = (await occupationForRoleText(coreTitle(app.title))) ?? (await occupationForRoleText(app.title))
        const viaBoard = own ? null : boardSocs.get(coreTitle(app.title))
        const soc = own ?? viaBoard?.socCode ?? null
        const occ = soc ? taxonomy?.profiles.get(soc) : undefined
        const board = soc ? await occupationBoard(soc) : null
        const asks = board?.asks ?? (occ ? inferredAsks(occ.elements.values()) : null)
        if (soc && asks && allAsks(asks).length > 0) {
          const rung = classifyTitleRung(app.title)
          draft = buildSnapshot({
            basis: 'inferred',
            socCode: soc,
            socTitle: occ?.title ?? viaBoard?.socTitle ?? null,
            asks,
            facts: {
              industry: industryKey(companyIndustry.get(normalizeOrgName(app.companyName ?? '')) ?? null),
              jobFunction: inferFunctionFromTitle(app.title) ?? board?.jobFunction ?? null,
              subFunction: null,
              level: rung.rank > 0 ? rung.rung : null,
              locationState: statesFromLocation(app.location).states[0] ?? null,
              employerSector: null,
            },
            memberKeywords: keywords,
          })
        }
      }
      if (!draft) {
        out.skipped++
        continue
      }
      const prior = existingByApp.get(app.id) ?? null
      // --rebuild-inferred: an inferred row is our reading of the title, not the job's own record, so it may be re-read when the rules improve.
      const rebuild = opts.rebuildInferred && prior?.basis === 'inferred' && draft.basis === 'inferred'
      if (!rebuild && !shouldReplaceSnapshot(prior, draft)) {
        out.skipped++
        continue
      }
      const data = {
        candidateId: app.candidateId,
        appliedAt: app.appliedAt ?? app.createdAt,
        title: app.title,
        companyName: app.companyName,
        basis: draft.basis,
        boardJobId: draft.boardJobId,
        socCode: draft.socCode,
        socTitle: draft.socTitle,
        skills: draft.skills,
        tools: draft.tools,
        aiSkills: draft.aiSkills,
        industry: draft.industry,
        jobFunction: draft.jobFunction,
        subFunction: draft.subFunction,
        level: draft.level,
        locationState: draft.locationState,
        region: draft.region,
        employerSector: draft.employerSector,
        matched: draft.matched,
        missing: draft.missing,
        matchPct: draft.matchPct,
        skillsHash: draft.skillsHash,
        currentMatched: draft.matched,
        currentMissing: draft.missing,
        currentMatchPct: draft.matchPct,
        currentSkillsHash: draft.skillsHash,
        currentAt: new Date(),
      }
      await prisma.applicationSkillSnapshot.upsert({ where: { jobPostingId: app.id }, create: { jobPostingId: app.id, ...data }, update: data })
      out[draft.basis]++
    } catch (err) {
      console.error('[skill-snapshot] snapshot failed', app.id, err)
      out.skipped++
    }
  }
  return out
}

/** Tracking-time hook. Never throws: recording an application must not fail because of this. */
export async function snapshotApplication(appId: string, link?: { postingId: string | null } | null): Promise<void> {
  try {
    await snapshotApplications([appId], link ? new Map([[appId, link]]) : undefined)
  } catch (err) {
    console.error('[skill-snapshot] hook failed', appId, err)
  }
}

/**
 * Recomputes the "current" match of a member's snapshots against their skills now, for rows whose
 * stored hash differs. The original matched / missing / matchPct are never touched.
 */
export async function refreshCurrentMatches(candidateId: string, keywords?: string[]): Promise<number> {
  const kws = keywords ?? memberKeywordsOf(await prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId }, select: SKILL_PROFILE_SELECT }))
  const hash = skillsHash(kws)
  const stale = await prisma.applicationSkillSnapshot.findMany({
    where: { candidateId, NOT: { currentSkillsHash: hash } },
    select: { id: true, skills: true, tools: true, aiSkills: true },
  })
  const now = new Date()
  for (let i = 0; i < stale.length; i += 50) {
    await prisma.$transaction(
      stale.slice(i, i + 50).map((s) => {
        const m = matchAsks(s, kws)
        return prisma.applicationSkillSnapshot.update({
          where: { id: s.id },
          data: { currentMatched: m.matched, currentMissing: m.missing, currentMatchPct: m.matchPct, currentSkillsHash: hash, currentAt: now },
        })
      }),
    )
  }
  return stale.length
}

const SUMMARY_SELECT = {
  appliedAt: true, basis: true, matchPct: true, missing: true, currentMatchPct: true, currentMissing: true, aiSkills: true,
  industry: true, jobFunction: true, level: true,
} as const

async function loadMemberRows(candidateId: string): Promise<SnapshotRow[]> {
  await refreshCurrentMatches(candidateId)
  return prisma.applicationSkillSnapshot.findMany({ where: { candidateId }, select: SUMMARY_SELECT, orderBy: { appliedAt: 'desc' } })
}

/** The member's application match and gaps, current against their skills now. Null on any failure or no snapshots. */
export const loadApplicationGapSummary = cache(async (candidateId: string): Promise<ApplicationGapSummary | null> => {
  try {
    const rows = await loadMemberRows(candidateId)
    if (rows.length === 0) return null
    return summarizeApplications(rows, new Date())
  } catch (err) {
    console.error('[skill-snapshot] summary failed', candidateId, err)
    return null
  }
})

// ── Courses and pay ──

/**
 * Posted-pay lift for an AI skill in the member's function, from the AI-skills analysis
 * (ai-skill-market.data.ts): the like-for-like premium (same level and industry), shown only when
 * the raw and like-for-like numbers both exist (the rule aiMarketLine follows). Null for other skills:
 * we have no defensible per-skill pay number for them.
 */
export function payLiftFor(term: string, ai: boolean, memberFunction: string | null | undefined): PayLift | null {
  if (!ai) return null
  const code = functionCode(memberFunction)
  const s = code ? AI_FUNCTION_STATS[code] : undefined
  if (!code || !s || s.likePct == null || s.rawPct == null || s.likePct <= 0) return null
  return { pct: s.likePct, text: `${CRAWLER_FUNCTION_LABEL[code]} postings that ask for an AI skill pay about ${s.likePct}% more, like-for-like.` }
}

// ── Admin and pitch ──

const AGG_SELECT = {
  candidateId: true, appliedAt: true, basis: true, matchPct: true, missing: true, industry: true, jobFunction: true, level: true,
  locationState: true, region: true,
} as const

/** Every snapshot since `since`, rolled up. Aggregates only. */
export async function loadSkillMatchReport(since?: Date): Promise<{ report: SkillMatchReport; rows: number }> {
  const rows: AggregateRow[] = await prisma.applicationSkillSnapshot.findMany({
    where: since ? { appliedAt: { gte: since } } : {},
    select: AGG_SELECT,
    orderBy: { appliedAt: 'desc' },
    take: 50_000,
  })
  return { report: buildSkillMatchReport(rows, new Date()), rows: rows.length }
}

/** Members (ids only) with snapshots, for the admin drill-down to the candidate page. */
export async function membersWithSnapshots(limit = 50): Promise<{ candidateId: string; applications: number; matchPct: number | null }[]> {
  const groups = await prisma.applicationSkillSnapshot.groupBy({
    by: ['candidateId'],
    _count: { _all: true },
    _avg: { matchPct: true },
    orderBy: { _count: { candidateId: 'desc' } },
    take: limit,
  })
  return groups.map((g) => ({ candidateId: g.candidateId, applications: g._count._all, matchPct: g._avg.matchPct == null ? null : Math.round(g._avg.matchPct) }))
}

// ── Backfill ──

/** Snapshots every applied application that has none (or whose link changed). Idempotent. */
export async function backfillApplicationSnapshots(opts: { batch?: number; rebuildInferred?: boolean } = {}): Promise<{ applications: number; posting: number; inferred: number; skipped: number }> {
  const apps = await prisma.jobPosting.findMany({ where: { appliedAt: { not: null } }, select: { id: true }, orderBy: { appliedAt: 'desc' } })
  const totals = { applications: apps.length, posting: 0, inferred: 0, skipped: 0 }
  const size = opts.batch ?? 100
  for (let i = 0; i < apps.length; i += size) {
    const r = await snapshotApplications(apps.slice(i, i + size).map((a) => a.id), undefined, { rebuildInferred: opts.rebuildInferred })
    totals.posting += r.posting
    totals.inferred += r.inferred
    totals.skipped += r.skipped
  }
  return totals
}

/**
 * The application-gap line a B2B retraining pitch can cite: the deck area's Census region when that
 * segment is citable, else all applications. Never throws; null when nothing is there.
 */
export async function pitchApplicationGapLine(state?: string | null): Promise<PitchGapLine | null> {
  try {
    const { report } = await loadSkillMatchReport(new Date(Date.now() - 365 * 86_400_000))
    const region = censusRegion(state)
    const regional = region ? report.byDimension.region.find((s) => s.segment === region) : undefined
    const line = regional ? pitchGapLine(regional) : null
    return line?.citable ? line : report.overall.applications > 0 ? pitchGapLine(report.overall) : null
  } catch (err) {
    console.error('[skill-snapshot] pitch line failed', err)
    return null
  }
}
