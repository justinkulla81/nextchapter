import 'server-only'
import { prisma } from '@/lib/prisma'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { getOrCreateCompany, resolveCompanyMetadataIfMissing } from '@/lib/companies/company-lookup'
import { tagEmployer } from '@/lib/companies/insider-network'

// The resume-confirm flow for Prompt 4.1's contribution gate — "We'll pull
// it from your resume, just confirm." Reads the candidate's existing
// WorkHistoryEntry rows (already resume-parsed or manually entered on the
// Profile/Resume pages, well before this feature existed) and offers each
// one not yet tagged into the insider-network graph as a one-click confirm.

export interface UntaggedWorkHistoryRow {
  workHistoryEntryId: string
  companyName: string
  roleTitle: string
  startDate: Date
  endDate: Date | null
  isCurrent: boolean
  resumeDerived: boolean
}

export async function getUntaggedWorkHistory(candidateId: string): Promise<UntaggedWorkHistoryRow[]> {
  const [workHistory, tagged] = await Promise.all([
    prisma.workHistoryEntry.findMany({
      where: { candidateId },
      orderBy: { startDate: 'desc' },
      select: {
        id: true,
        companyName: true,
        roleTitle: true,
        startDate: true,
        endDate: true,
        isCurrent: true,
        resumeDerived: true,
      },
    }),
    prisma.memberEmployment.findMany({
      where: { candidateId },
      select: { company: { select: { canonicalNameNormalized: true } } },
    }),
  ])

  const taggedNames = new Set(tagged.map((t) => t.company.canonicalNameNormalized))
  return workHistory
    .filter((w) => !taggedNames.has(normalizeOrgName(w.companyName)))
    .map((w) => ({
      workHistoryEntryId: w.id,
      companyName: w.companyName,
      roleTitle: w.roleTitle,
      startDate: w.startDate,
      endDate: w.endDate,
      isCurrent: w.isCurrent,
      resumeDerived: w.resumeDerived,
    }))
}

export interface ConfirmWorkHistoryResult {
  ok: boolean
  error?: string
  created: boolean
  companyId?: string
}

// Confirms one WorkHistoryEntry row into the insider-network graph — used
// both by the gate's "confirm" list and, indirectly, by the on-page
// "I worked here" shortcut (which synthesizes the same shape for a manual
// add, see tagEmployerManually below).
export async function confirmWorkHistoryEntry(
  candidateId: string,
  workHistoryEntryId: string
): Promise<ConfirmWorkHistoryResult> {
  const entry = await prisma.workHistoryEntry.findFirst({ where: { id: workHistoryEntryId, candidateId } })
  if (!entry) return { ok: false, error: 'That work history entry was not found.', created: false }

  const company = await getOrCreateCompany(entry.companyName)
  resolveCompanyMetadataIfMissing(company).catch(() => {}) // best-effort, don't block the tag

  const result = await tagEmployer({
    candidateId,
    companyId: company.id,
    title: entry.roleTitle,
    startDate: entry.startDate,
    endDate: entry.endDate,
    isCurrent: entry.isCurrent,
    verifiedFromResume: entry.resumeDerived,
    sourceWorkHistoryEntryId: entry.id,
  })
  return { ok: true, created: result.created, companyId: company.id }
}

export interface ManualTagInput {
  candidateId: string
  companyName: string
  title: string
  startDate: Date | null
  endDate: Date | null
  isCurrent: boolean
}

export async function tagEmployerManually(input: ManualTagInput): Promise<ConfirmWorkHistoryResult> {
  if (!input.companyName.trim() || !input.title.trim()) {
    return { ok: false, error: 'Enter both a company name and a title.', created: false }
  }
  const company = await getOrCreateCompany(input.companyName)
  resolveCompanyMetadataIfMissing(company).catch(() => {})

  const result = await tagEmployer({
    candidateId: input.candidateId,
    companyId: company.id,
    title: input.title.trim(),
    startDate: input.startDate,
    endDate: input.endDate,
    isCurrent: input.isCurrent,
    verifiedFromResume: false,
  })
  return { ok: true, created: result.created, companyId: company.id }
}
