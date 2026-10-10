import 'server-only'
import { prisma } from '@/lib/prisma'
import { normalizeOrgName, orgNamesMatch } from '@/lib/text/org-name-match'
import { linkPostingToCompany } from '@/lib/companies/posting-company'

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
  employers: ResumeEmployerInput[],
  opts: { resumeId?: string } = {}
): Promise<{ insertedCount: number; undatedCount: number }> {
  const named = employers.filter((entry) => entry.companyName?.trim() && entry.roleTitle?.trim())
  const valid = named.filter((entry) => entry.startDate)
  // Jobs with no start date are not dropped: they still tie the member to a company
  // (alumni networks, feedback requests), they are just kept apart from the dated
  // history so they can never distort tenure or gap analysis.
  const undatedCount = await saveUndated(
    candidateId,
    named.filter((entry) => !entry.startDate),
    opts.resumeId
  )
  if (valid.length === 0) return { insertedCount: 0, undatedCount }

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
        // Best-effort: null when the name isn't an employer or the lookup fails; the
        // backfill links it later.
        companyId: await linkPostingToCompany(entry.companyName),
      },
    })
    existing.push(created)
    insertedCount++
  }

  return { insertedCount, undatedCount }
}

async function saveUndated(candidateId: string, entries: ResumeEmployerInput[], resumeId?: string): Promise<number> {
  let count = 0
  for (const entry of entries) {
    const companyNameNormalized = normalizeOrgName(entry.companyName)
    if (!companyNameNormalized) continue
    try {
      await prisma.undatedEmployment.upsert({
        where: {
          candidateId_companyNameNormalized_roleTitle: { candidateId, companyNameNormalized, roleTitle: entry.roleTitle.trim() },
        },
        create: {
          candidateId,
          resumeId: resumeId ?? null,
          companyName: entry.companyName.trim(),
          companyNameNormalized,
          companyId: await linkPostingToCompany(entry.companyName),
          roleTitle: entry.roleTitle.trim(),
          endDate: entry.endDate,
          isCurrent: entry.isCurrent,
        },
        update: {},
      })
      count++
    } catch (error) {
      console.error('Could not save undated employment:', entry.companyName, error)
    }
  }
  return count
}
