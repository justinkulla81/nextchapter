import 'server-only'
import { prisma } from '@/lib/prisma'
import { normalizeOrgName, orgNamesMatch } from '@/lib/text/org-name-match'

export interface ResumeEmployerInput {
  companyName: string
  roleTitle: string
  startDate: Date | null
  endDate: Date | null
  isCurrent: boolean
  companyIndustry: string | null
}

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart <= bEnd && bStart <= aEnd
}

// Insert-if-absent only — never updates or deletes an existing row (manual
// entries and prior syncs are never overwritten). A row only counts as a
// duplicate when the company name matches (loose containment — "Google" vs
// "Google LLC") AND the date ranges overlap, so a real second stint at the
// same company isn't mistaken for a dupe of the first one. Employers with
// no startDate are skipped entirely — a fabricated date would corrupt the
// gap analysis downstream.
export async function syncResumeWorkHistory(
  candidateId: string,
  employers: ResumeEmployerInput[]
): Promise<{ insertedCount: number }> {
  const valid = employers.filter(
    (entry) => entry.startDate && entry.companyName?.trim() && entry.roleTitle?.trim()
  )
  if (valid.length === 0) return { insertedCount: 0 }

  const existing = await prisma.workHistoryEntry.findMany({ where: { candidateId } })
  const now = new Date()

  let insertedCount = 0
  for (const entry of valid) {
    const entryStart = entry.startDate as Date
    const entryEnd = entry.isCurrent ? now : (entry.endDate ?? now)

    const isDuplicate = existing.some((row) => {
      if (!orgNamesMatch(row.companyName, entry.companyName)) return false
      const rowEnd = row.isCurrent ? now : (row.endDate ?? now)
      return rangesOverlap(row.startDate, rowEnd, entryStart, entryEnd)
    })
    if (isDuplicate) continue

    const created = await prisma.workHistoryEntry.create({
      data: {
        candidateId,
        companyName: entry.companyName,
        companyNameNormalized: normalizeOrgName(entry.companyName),
        companyIndustry: entry.companyIndustry,
        roleTitle: entry.roleTitle,
        startDate: entryStart,
        endDate: entry.isCurrent ? null : entry.endDate,
        isCurrent: entry.isCurrent,
        resumeDerived: true,
      },
    })
    existing.push(created)
    insertedCount++
  }

  return { insertedCount }
}
