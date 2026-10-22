import 'server-only'
import { prisma } from '@/lib/prisma'
import { lookupOccupation, isExposureLevel, type ExposureLevel } from '@/lib/aei/job-exposure'
import { memberSkillAiUse } from '@/lib/aei/skills'

// Anthropic Economic Index data for the app (src/lib/aei/job-exposure.ts says what it means). The
// occupation table is ~1,000 rows: read once per server instance per hour, served stale while a
// fresh copy loads. Fail-soft: callers get an empty map and show no AEI signal.

export interface AeiTopTask {
  taskId: number
  text: string
  pct: number
  automationPct: number | null
}

export interface AeiOccupationRow {
  socCode: string
  title: string
  basis: string
  taskCount: number
  tasksUsed: number
  taskCoveragePct: number | null
  convSharePct: number | null
  automationPct: number | null
  augmentationPct: number | null
  exposureLevel: ExposureLevel
  topTasks: AeiTopTask[]
}

const TTL_MS = 60 * 60_000
let cache: { at: number; value: Promise<Map<string, AeiOccupationRow>> } | null = null

async function readOccupations(): Promise<Map<string, AeiOccupationRow>> {
  const rows = await prisma.aeiOccupation.findMany()
  const out = new Map<string, AeiOccupationRow>()
  for (const r of rows) {
    if (!isExposureLevel(r.exposureLevel)) continue
    out.set(r.socCode, {
      socCode: r.socCode,
      title: r.title,
      basis: r.basis,
      taskCount: r.taskCount,
      tasksUsed: r.tasksUsed,
      taskCoveragePct: r.taskCoveragePct,
      convSharePct: r.convSharePct,
      automationPct: r.automationPct,
      augmentationPct: r.augmentationPct,
      exposureLevel: r.exposureLevel,
      topTasks: Array.isArray(r.topTasks) ? (r.topTasks as unknown as AeiTopTask[]) : [],
    })
  }
  return out
}

/** Every AEI occupation by O*NET-SOC code. Empty when the table is missing or unreadable. */
export function loadAeiOccupations(now = Date.now()): Promise<Map<string, AeiOccupationRow>> {
  if (cache && now - cache.at < TTL_MS) return cache.value
  const previous = cache?.value
  const entry = { at: now, value: Promise.resolve(new Map<string, AeiOccupationRow>()) }
  entry.value = readOccupations().catch(async (error) => {
    console.error('AEI occupations unavailable', error)
    entry.at = now - TTL_MS + 60_000 // retry in a minute
    return previous ? await previous : new Map<string, AeiOccupationRow>()
  })
  cache = entry
  return entry.value
}

/** The AEI row for an occupation code (with the detailed-SOC fallbacks in lookupOccupation). */
export async function aeiOccupationFor(soc: string | null | undefined): Promise<AeiOccupationRow | null> {
  return lookupOccupation(await loadAeiOccupations(), soc)
}

/**
 * Sets aiExposureLevel on these jobs from their aeiSocCode (exact O*NET code, else the detailed
 * SOC's ".00"). Best-effort: a failure is logged and never fails the caller (the job import).
 */
export async function refreshAiExposureLevels(urls: string[]): Promise<void> {
  try {
    for (let i = 0; i < urls.length; i += 1000) {
      const chunk = urls.slice(i, i + 1000)
      await prisma.$executeRaw`
        UPDATE "ExclusiveJobPosting" AS j SET "aiExposureLevel" = v.lvl
        FROM (
          SELECT e."id", COALESCE(
            (SELECT a."exposureLevel" FROM "AeiOccupation" a WHERE a."socCode" = e."aeiSocCode"),
            (SELECT a."exposureLevel" FROM "AeiOccupation" a WHERE a."socCode" = left(e."aeiSocCode", 7) || '.00')
          ) AS lvl
          FROM "ExclusiveJobPosting" e WHERE e."url" = ANY(${chunk}::text[]) AND e."aeiSocCode" IS NOT NULL
        ) AS v
        WHERE j."id" = v."id" AND j."aiExposureLevel" IS DISTINCT FROM v.lvl`
    }
  } catch (error) {
    console.error('AEI: could not refresh job exposure levels', error)
  }
}

export interface AeiSkillRow {
  skillId: string
  name: string
  taskCount: number
  usagePct: number
  automationPct: number | null
  augmentationPct: number | null
  topTask: string | null
}

let skillCache: { at: number; value: Promise<AeiSkillRow[]> } | null = null

/** Skills with an AEI automation / augmentation split (AeiSkill). Empty when unavailable. */
export function loadAeiSkills(now = Date.now()): Promise<AeiSkillRow[]> {
  if (skillCache && now - skillCache.at < TTL_MS) return skillCache.value
  const value = prisma.aeiSkill.findMany().catch((error) => {
    console.error('AEI skills unavailable', error)
    return [] as AeiSkillRow[]
  })
  skillCache = { at: now, value }
  return value
}

/** A member's skills (the skills matrix's list) split into mostly automated / mostly augmented by AI. */
export async function loadMemberSkillAiUse(labels: readonly string[]) {
  const skills = await loadAeiSkills()
  return memberSkillAiUse(labels, skills)
}
