import 'server-only'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { loadAiMarket } from '@/lib/skills/ai-market-live'
import { paysMore } from '@/lib/skills/ai-market'
import { JOURNEYS } from '@/lib/journey/journey'
import { ROLES, SOURCES } from '@/lib/pivots/pivot-map'
import { edgesFor } from '@/lib/pivots/onet'
import { buildWorkforceTiles, entryLevelLine, type WorkforceRaw, type WorkforceTileGroup } from './workforce-numbers-format'

// "By the numbers" on the workforce page (https://launchyournextchapter.com/government-workforce).
// Every figure is counted from the live database or the app's own tables, cached for a day,
// and floored before it is shown (workforce-numbers-format.ts). Each group is cached on its
// own and a failed query throws, so a failure is never cached and only hides its own tiles.

// The board's definition of an open job (same as src/lib/skills/ai-market-live.ts).
const LIVE = `"status" = 'approved' AND "archivedAt" IS NULL AND "institutionScopeId" IS NULL AND COALESCE("distribution", '') <> 'EXCLUDED'
  AND ("expiresAt" IS NULL OR "expiresAt" > now()) AND COALESCE("employmentType", '') NOT IN ('internship', 'co_op', 'coop')`
const US_STATES = `'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'`

type JobRow = {
  live: number
  checked_24h: number
  ai_skill: number
  government: number
  nonprofit: number
  academia: number
  flagged: number
  clearance: number
  employers: number
  occupations: number
  industries: number
  functions: number
  states: number
  places: number
  entry_no_exp: number
  entry_ai: number
}

async function jobCounts(): Promise<JobRow> {
  // One pass over the open board (~10 s at 500k rows), hence the daily cache. Counted per role,
  // not per row: rows sharing a crawlerFingerprint (a re-issued aggregator URL whose old row is
  // still live) count once, using the most recently checked row; rows with no fingerprint count
  // one each. Crawler rows that closed today stay in until the next import archives them; the
  // board has no cheaper signal for that.
  const [row] = await prisma.$queryRawUnsafe<JobRow[]>(`WITH roles AS (
      SELECT DISTINCT ON (COALESCE("crawlerFingerprint", "id"))
        "lastVerifiedAt", "aiSkillGroups", "employerSector", "requirementFlags", "companyId", "companyName",
        "socCode", "industry", "targetFunction", "locationState", "locationCity", "level", "postingSignals"
      FROM "ExclusiveJobPosting" WHERE ${LIVE}
      ORDER BY COALESCE("crawlerFingerprint", "id"), "lastVerifiedAt" DESC NULLS LAST, "createdAt" DESC
    )
    SELECT count(*)::int AS live,
      count(*) FILTER (WHERE "lastVerifiedAt" > now() - interval '24 hours')::int AS checked_24h,
      count(*) FILTER (WHERE cardinality("aiSkillGroups") > 0)::int AS ai_skill,
      count(*) FILTER (WHERE "employerSector" = 'government')::int AS government,
      count(*) FILTER (WHERE "employerSector" = 'nonprofit')::int AS nonprofit,
      count(*) FILTER (WHERE "employerSector" = 'academia')::int AS academia,
      count(*) FILTER (WHERE jsonb_typeof("requirementFlags") = 'array' AND jsonb_array_length("requirementFlags") > 0)::int AS flagged,
      count(*) FILTER (WHERE jsonb_typeof("requirementFlags") = 'array' AND "requirementFlags" @> '[{"flag":"clearance"}]')::int AS clearance,
      count(DISTINCT COALESCE("companyId", lower("companyName")))::int AS employers,
      count(DISTINCT "socCode")::int AS occupations,
      count(DISTINCT "industry")::int AS industries,
      count(DISTINCT "targetFunction")::int AS functions,
      count(DISTINCT upper("locationState")) FILTER (WHERE upper("locationState") IN (${US_STATES}))::int AS states,
      count(DISTINCT lower("locationCity") || '|' || upper("locationState"))
        FILTER (WHERE "locationCity" IS NOT NULL AND upper("locationState") IN (${US_STATES}))::int AS places,
      count(*) FILTER (WHERE "level" IN ('ENTRY_IC', 'EARLY_IC') AND 'no_experience_ok' = ANY("postingSignals"))::int AS entry_no_exp,
      count(*) FILTER (WHERE "level" IN ('ENTRY_IC', 'EARLY_IC') AND 'entry_ai' = ANY("postingSignals"))::int AS entry_ai
    FROM roles`)
  if (!row) throw new Error('job counts returned no row')
  return row
}

type TaxonomyRow = {
  skills: number
  occupations_mapped: number
  similarity_pairs: number
  courses: number
  ai_courses: number
  certifications: number
  job_centers: number
  job_center_states: number
}

async function taxonomyCounts(): Promise<TaxonomyRow> {
  const [row] = await prisma.$queryRawUnsafe<TaxonomyRow[]>(`SELECT
      (SELECT count(*) FROM "Skill")::int AS skills,
      (SELECT count(DISTINCT "socCode") FROM "OccupationSimilarity")::int AS occupations_mapped,
      (SELECT count(*) FROM "OccupationSimilarity")::int AS similarity_pairs,
      (SELECT count(*) FROM "Course" WHERE "isActive")::int AS courses,
      (SELECT count(*) FROM "Course" WHERE "isActive" AND "category" = 'AI_TRAINING')::int AS ai_courses,
      (SELECT count(*) FROM "Course" WHERE "isActive" AND "category" = 'CERTIFICATION')::int AS certifications,
      (SELECT count(*) FROM "AmericanJobCenter")::int AS job_centers,
      (SELECT count(DISTINCT "state") FROM "AmericanJobCenter")::int AS job_center_states`)
  if (!row) throw new Error('taxonomy counts returned no row')
  return row
}

const DAY = 86_400
const cachedJobs = unstable_cache(jobCounts, ['workforce-numbers-jobs-v4'], { revalidate: DAY })
const cachedTaxonomy = unstable_cache(taxonomyCounts, ['workforce-numbers-taxonomy-v1'], { revalidate: DAY })

async function safe<T>(label: string, run: () => Promise<T>): Promise<T | null> {
  try {
    return await run()
  } catch (error) {
    console.error(`workforce numbers: ${label} unavailable`, error)
    return null
  }
}

/** Pivot paths members are offered: hand-written edges plus the O*NET-related ones, per source role. */
function pivotCounts() {
  const pairs = new Set<string>()
  for (const key of SOURCES.keys()) for (const e of edgesFor(key)) pairs.add(`${key}>${e.to}`)
  return { pivotPaths: pairs.size, pivotRoles: ROLES.size }
}

export async function loadWorkforceNumbers(): Promise<WorkforceTileGroup[]> {
  const [jobs, taxonomy, ai] = await Promise.all([
    safe('job counts', cachedJobs),
    safe('taxonomy counts', cachedTaxonomy),
    safe('AI market snapshot', () => loadAiMarket()),
  ])
  const pivots = (() => {
    try {
      return pivotCounts()
    } catch (error) {
      console.error('workforce numbers: pivot map unavailable', error)
      return null
    }
  })()
  const raw: WorkforceRaw = {
    jobs: jobs && {
      live: jobs.live,
      checked24h: jobs.checked_24h,
      aiSkill: jobs.ai_skill,
      government: jobs.government,
      nonprofit: jobs.nonprofit,
      academia: jobs.academia,
      flagged: jobs.flagged,
      clearance: jobs.clearance,
      employers: jobs.employers,
      occupations: jobs.occupations,
      industries: jobs.industries,
      functions: jobs.functions,
      states: jobs.states,
      places: jobs.places,
      entryNoExp: jobs.entry_no_exp,
      entryAi: jobs.entry_ai,
    },
    taxonomy: taxonomy && {
      skills: taxonomy.skills,
      occupationsMapped: taxonomy.occupations_mapped,
      similarityPairs: taxonomy.similarity_pairs,
      courses: taxonomy.courses,
      aiCourses: taxonomy.ai_courses,
      certifications: taxonomy.certifications,
      jobCenters: taxonomy.job_centers,
      jobCenterStates: taxonomy.job_center_states,
    },
    aiPremiumPct: ai?.overall && paysMore(ai.overall) ? (ai.overall.likePct ?? null) : null,
    pivots,
    journeys: JOURNEYS.length,
  }
  return buildWorkforceTiles(raw)
}

/** "X entry-level jobs welcome people with no experience; Y entry-level jobs ask for AI skills." from the same
 * deduped, day-cached counts as the tiles; null when they fail or are zero. */
export async function loadEntryLevelLine(): Promise<string | null> {
  const jobs = await safe('job counts', cachedJobs)
  return jobs ? entryLevelLine({ ...emptyJobs, entryNoExp: jobs.entry_no_exp, entryAi: jobs.entry_ai }) : null
}

const emptyJobs = {
  live: 0, checked24h: 0, aiSkill: 0, government: 0, nonprofit: 0, academia: 0, flagged: 0, clearance: 0,
  employers: 0, occupations: 0, industries: 0, functions: 0, states: 0, places: 0,
}
