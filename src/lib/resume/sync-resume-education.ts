import 'server-only'
import { prisma } from '@/lib/prisma'
import { normalizeOrgName, orgNamesMatchStrict } from '@/lib/text/org-name-match'

export interface ResumeEducationInput {
  schoolName: string
  degree: string | null
  fieldOfStudy: string | null
  graduationDate: Date | null
}

// Doctorate-level degrees outrank Master's/MBA/JD/MD, which outrank
// Bachelor's, which outrank Associate's — used only to break isPrimary ties
// when graduation dates are equal or missing. `degree` here is the raw
// resume string (e.g. "MBA", "B.S."), not the CandidateProfile-level
// HighestEducationLevel enum.
function degreeRank(degree: string | null): number {
  if (!degree) return 0
  const d = degree.toLowerCase()
  if (/\b(ph\.?d|doctorate|dphil)\b/.test(d)) return 5
  if (/\bm\.?d\b/.test(d)) return 5
  if (/\bd\.?o\b/.test(d)) return 5
  if (/\bj\.?d\b/.test(d)) return 5
  if (/\b(pharm\.?d|dds|dmd|dvm|psy\.?d)\b/.test(d)) return 5
  if (/\bmba\b/.test(d)) return 4
  if (/\bmph\b/.test(d)) return 4
  if (/\b(m\.?s|m\.?a|master'?s?)\b/.test(d)) return 4
  if (/\b(b\.?s|b\.?a|bachelor'?s?)\b/.test(d)) return 3
  if (/\b(a\.?s|a\.?a|associate'?s?)\b/.test(d)) return 2
  return 1
}

// Insert-if-absent only — never updates or deletes an existing row, so a
// candidate's manual edits (or a prior sync) are never silently overwritten.
// Matched via orgNamesMatchStrict since loose containment is actively wrong
// for schools ("Michigan" is contained in "Michigan State University" but
// they're different institutions).
export async function syncResumeEducation(
  candidateId: string,
  education: ResumeEducationInput[]
): Promise<{ insertedCount: number }> {
  const valid = education.filter((entry) => entry.schoolName?.trim())
  if (valid.length === 0) return { insertedCount: 0 }

  const existing = await prisma.educationEntry.findMany({
    where: { candidateId },
    orderBy: { createdAt: 'asc' },
  })

  let insertedCount = 0
  for (const entry of valid) {
    const alreadyExists = existing.some((row) => orgNamesMatchStrict(row.schoolName, entry.schoolName))
    if (alreadyExists) continue

    const created = await prisma.educationEntry.create({
      data: {
        candidateId,
        schoolName: entry.schoolName,
        schoolNameNormalized: normalizeOrgName(entry.schoolName),
        degree: entry.degree,
        fieldOfStudy: entry.fieldOfStudy,
        graduationDate: entry.graduationDate,
        resumeDerived: true,
      },
    })
    existing.push(created)
    insertedCount++
  }

  if (insertedCount > 0) {
    await recomputePrimaryIfNeeded(candidateId)
  }

  return { insertedCount }
}

// Only runs when no row is already primary — a candidate (or a previous
// sync pass) choosing a primary school is never second-guessed.
async function recomputePrimaryIfNeeded(candidateId: string): Promise<void> {
  const rows = await prisma.educationEntry.findMany({
    where: { candidateId },
    orderBy: { createdAt: 'asc' },
  })
  if (rows.length === 0 || rows.some((row) => row.isPrimary)) return

  const [winner] = [...rows].sort((a, b) => {
    const aGrad = a.graduationDate?.getTime() ?? -Infinity
    const bGrad = b.graduationDate?.getTime() ?? -Infinity
    if (aGrad !== bGrad) return bGrad - aGrad
    const rankDiff = degreeRank(b.degree) - degreeRank(a.degree)
    if (rankDiff !== 0) return rankDiff
    return 0 // stable sort — createdAt-ascending order stands in for "first-listed"
  })

  await prisma.educationEntry.update({ where: { id: winner.id }, data: { isPrimary: true } })
}
