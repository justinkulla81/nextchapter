import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { sharedLoad, sharedPartsLoad } from '@/lib/db/heavy'
import type { ElementKind, OccupationProfile } from '@/lib/careers/types'
import { buildVectorSpace, type VectorSpace } from '@/lib/careers/vectors'
import { buildTitleIndex, type TitleIndex } from '@/lib/careers/title-match'

export interface Taxonomy {
  profiles: Map<string, OccupationProfile>
  space: VectorSpace
}

// The taxonomy changes when someone runs the importers, not between requests.
// Holding it in memory for an hour avoids re-reading ~60k rows on every Pivot
// Tool visit; a stale copy for up to an hour after an import is harmless.
const TTL_MS = 60 * 60 * 1000
const TAXONOMY_SHARED_SEC = 24 * 3600

let taxonomyMemo: { at: number; value: Promise<Taxonomy | null> } | null = null
let titleMemo: { at: number; value: Promise<TitleIndex | null> } | null = null

async function loadTaxonomy(): Promise<Taxonomy | null> {
  try {
    const [occupations, skillRows, links, related] = await Promise.all([
      // The rows come from the shared data cache, kept a day (they change only when someone runs the importers): every cold instance
      // used to read ~42k rows itself (owner decision 2026-11-17, Supabase egress).
      sharedLoad('taxonomy-occupations-v1', TAXONOMY_SHARED_SEC, () =>
        prisma.occupation.findMany({ select: { socCode: true, title: true, jobZone: true, medianWage: true, employment: true, growthPct: true, annualOpenings: true, typicalEducation: true } }), { reviveDates: false }),
      sharedLoad('taxonomy-skills-v1', TAXONOMY_SHARED_SEC, () => prisma.skill.findMany({ select: { id: true, name: true, kind: true } }), { reviveDates: false }),
      sharedPartsLoad('taxonomy-occupation-skills-v1', 3, TAXONOMY_SHARED_SEC, (part) =>
        prisma.$queryRaw<{ socCode: string; skillId: string; importance: number; level: number | null; hotTech: boolean }[]>(
          Prisma.sql`SELECT "socCode", "skillId", importance, level, "hotTech" FROM "OccupationSkill" WHERE (hashtext("socCode") & 2147483647) % 3 = ${part}::int`
        )),
      sharedLoad('taxonomy-related-v1', TAXONOMY_SHARED_SEC, () =>
        prisma.occupationRelated.findMany({ orderBy: [{ socCode: 'asc' }, { rank: 'asc' }], select: { socCode: true, relatedSocCode: true } }), { reviveDates: false }),
    ])
    if (occupations.length === 0 || links.length === 0) return null

    const skills = new Map(skillRows.map((s) => [s.id, s]))
    const profiles = new Map<string, OccupationProfile>()
    for (const o of occupations) {
      profiles.set(o.socCode, {
        socCode: o.socCode,
        title: o.title,
        jobZone: o.jobZone,
        medianWage: o.medianWage,
        employment: o.employment,
        growthPct: o.growthPct,
        annualOpenings: o.annualOpenings,
        typicalEducation: o.typicalEducation,
        elements: new Map(),
        relatedSocCodes: [],
      })
    }
    for (const l of links) {
      const skill = skills.get(l.skillId)
      const profile = profiles.get(l.socCode)
      if (!skill || !profile) continue
      profile.elements.set(l.skillId, { name: skill.name, kind: skill.kind as ElementKind, importance: l.importance, level: l.level, hotTech: l.hotTech })
    }
    for (const r of related) profiles.get(r.socCode)?.relatedSocCodes.push(r.relatedSocCode)

    // "All other" catch-all occupations have no ratings; they can't be compared.
    for (const [soc, p] of profiles) if (![...p.elements.values()].some((e) => e.kind !== 'TECHNOLOGY')) profiles.delete(soc)
    if (profiles.size === 0) return null

    return { profiles, space: buildVectorSpace([...profiles.values()]) }
  } catch (error) {
    // Most likely the tables don't exist yet (SQL not run) or are empty. Callers
    // show "not available yet"; nothing else should break.
    console.error('Career taxonomy unavailable:', error)
    return null
  }
}

/** The loaded taxonomy, or null when the tables are missing or empty. */
export function getTaxonomy(): Promise<Taxonomy | null> {
  const now = Date.now()
  if (!taxonomyMemo || now - taxonomyMemo.at > TTL_MS) {
    taxonomyMemo = { at: now, value: loadTaxonomy() }
    // Don't pin a failure for an hour.
    taxonomyMemo.value.then((v) => {
      if (v === null) taxonomyMemo = null
    })
  }
  return taxonomyMemo.value
}

async function loadTitleIndex(): Promise<TitleIndex | null> {
  try {
    const [occupations, altTitles] = await Promise.all([
      // Shared across instances for a day, like the taxonomy rows above (2026-11-17 egress: every cold instance read ~8k titles).
      sharedLoad('title-index-occupations-v1', TAXONOMY_SHARED_SEC, () => prisma.occupation.findMany({ select: { socCode: true, title: true } }), { reviveDates: false }),
      sharedLoad('title-index-alt-titles-v1', TAXONOMY_SHARED_SEC, () => prisma.occupationAltTitle.findMany({ select: { socCode: true, title: true } }), { reviveDates: false }),
    ])
    return occupations.length === 0 ? null : buildTitleIndex(occupations, altTitles)
  } catch (error) {
    console.error('Career title index unavailable:', error)
    return null
  }
}

export function getTitleIndex(): Promise<TitleIndex | null> {
  const now = Date.now()
  if (!titleMemo || now - titleMemo.at > TTL_MS) {
    titleMemo = { at: now, value: loadTitleIndex() }
    titleMemo.value.then((v) => {
      if (v === null) titleMemo = null
    })
  }
  return titleMemo.value
}
