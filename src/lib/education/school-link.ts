import 'server-only'
import { prisma } from '@/lib/prisma'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { SCHOOL_SEEDS } from '@/lib/education/school-seeds'
import { buildSchoolIndex, inferDegreeLevel, resolveSchool, schoolKey, type SchoolIndex, type SchoolRecord } from '@/lib/education/school-match'

// Ties each education entry to ONE canonical School, for existing resumes (backfill)
// and every new one (called from the resume sync). Never throws into the resume
// pipeline's critical path: an entry that can't be linked simply stays unlinked and
// the nightly backfill picks it up.

let seeded = false

/** Make sure the well-known institutions exist. Idempotent; creates only what is missing. */
export async function ensureSchoolsSeeded(): Promise<void> {
  if (seeded) return
  const existing = new Set((await prisma.school.findMany({ select: { canonicalKey: true } })).map((s) => s.canonicalKey))
  for (const seed of SCHOOL_SEEDS) {
    const key = schoolKey(seed.name)
    if (existing.has(key)) continue
    await prisma.school
      .create({ data: { name: seed.name, canonicalKey: key, aliases: seed.aliases, verified: true } })
      .catch(() => undefined) // a concurrent seeder won the race
  }
  seeded = true
}

export async function loadSchoolIndex(): Promise<{ index: SchoolIndex; records: SchoolRecord[] }> {
  const rows = await prisma.school.findMany({
    where: { OR: [{ reviewState: null }, { reviewState: { not: 'REVIEW' } }] },
    select: { id: true, name: true, canonicalKey: true, aliases: true },
  })
  return { index: buildSchoolIndex(rows), records: rows }
}

export interface SchoolLinkResult {
  schoolId: string
  outcome: 'exact' | 'division' | 'created' | 'review'
}

/**
 * Resolve a resume's school text to a School id, creating one when the school is
 * unknown. A near-miss to a known school is created UNVERIFIED and flagged for review
 * with the suggested target — it is not merged.
 */
export async function resolveOrCreateSchool(rawName: string, ctx?: { index: SchoolIndex }): Promise<SchoolLinkResult | null> {
  const name = rawName.trim()
  if (!name) return null
  const index = ctx?.index ?? (await loadSchoolIndex()).index
  const match = resolveSchool(name, index)
  if (match.kind === 'exact' || match.kind === 'division') {
    return { schoolId: match.schoolId, outcome: match.kind }
  }

  const key = schoolKey(name)
  if (!key) return null
  const suggestion = match.kind === 'close' ? match.candidates[0] : null
  // Metadata from the outreach college directory when the name matches one exactly.
  const local = await prisma.localCollege.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
    select: { id: true, state: true },
  })
  const school = await prisma.school.upsert({
    where: { canonicalKey: key },
    create: {
      name,
      canonicalKey: key,
      aliases: [],
      verified: false,
      localCollegeId: local?.id ?? null,
      state: local?.state ?? null,
      reviewState: suggestion ? 'REVIEW' : null,
      mergeSuggestionId: suggestion?.id ?? null,
    },
    update: {},
    select: { id: true, reviewState: true },
  })
  return { schoolId: school.id, outcome: school.reviewState === 'REVIEW' ? 'review' : 'created' }
}

export async function linkEducationEntry(entry: { id: string; schoolName: string; degree: string | null }, ctx?: { index: SchoolIndex }) {
  const resolved = await resolveOrCreateSchool(entry.schoolName, ctx)
  await prisma.educationEntry.update({
    where: { id: entry.id },
    data: { schoolId: resolved?.schoolId ?? null, degreeLevel: inferDegreeLevel(entry.degree) },
  })
  return resolved
}

/** Backfill: every education entry without a school. Safe to re-run. */
export async function linkAllEducation(): Promise<{ linked: number; created: number; review: number }> {
  await ensureSchoolsSeeded()
  const rows = await prisma.educationEntry.findMany({
    where: { schoolId: null },
    select: { id: true, schoolName: true, degree: true },
  })
  const out = { linked: 0, created: 0, review: 0 }
  // The index is rebuilt after any create so later rows in this run can match it.
  let ctx = await loadSchoolIndex()
  for (const row of rows) {
    const r = await linkEducationEntry(row, { index: ctx.index })
    if (!r) continue
    if (r.outcome === 'created' || r.outcome === 'review') {
      ctx = await loadSchoolIndex()
      if (r.outcome === 'review') out.review++
      else out.created++
    } else out.linked++
  }
  return out
}

export const schoolNameKey = normalizeOrgName
