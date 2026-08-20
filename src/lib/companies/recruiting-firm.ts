import 'server-only'
import { prisma } from '@/lib/prisma'
import { orgNamesMatch } from '@/lib/text/org-name-match'

export interface RecruiterAtFirm {
  id: string
  fullName: string
}

export interface FirmJobPosting {
  id: string
  title: string
  location: string | null
  audienceTier: string
}

export interface RecruitingFirmData {
  recruiters: RecruiterAtFirm[]
  jobs: FirmJobPosting[]
}

// A recruiter's own "firm" (Recruiter.firmName, or a real RecruiterFirm row
// via recruiterFirmId) has no FK to the candidate-facing Company directory
// — confirmed no such link exists anywhere in the schema — so matching
// happens the same fuzzy way every other company-name comparison in this
// codebase does (orgNamesMatch against Company.name). Recruiter is a small
// table, so fetching every row with a firm on file and matching in memory
// is cheap — no need for the DB-level contains-prefilter pattern
// candidate-contacts-at-company.ts uses for the much larger contacts table.
export async function getRecruitingFirmData(companyName: string): Promise<RecruitingFirmData> {
  const candidates = await prisma.recruiter.findMany({
    where: { OR: [{ firmName: { not: null } }, { recruiterFirmId: { not: null } }] },
    select: { id: true, fullName: true, firmName: true, recruiterFirm: { select: { name: true } } },
  })
  const matched = candidates.filter(
    (r) => orgNamesMatch(r.firmName ?? '', companyName) || orgNamesMatch(r.recruiterFirm?.name ?? '', companyName)
  )
  if (matched.length === 0) return { recruiters: [], jobs: [] }

  const jobs = await prisma.exclusiveJobPosting.findMany({
    where: { submittedByRecruiterId: { in: matched.map((r) => r.id) }, status: 'approved', archivedAt: null },
    select: { id: true, title: true, location: true, audienceTier: true },
    orderBy: { createdAt: 'desc' },
  })

  return {
    recruiters: matched.map((r) => ({ id: r.id, fullName: r.fullName })),
    jobs,
  }
}
