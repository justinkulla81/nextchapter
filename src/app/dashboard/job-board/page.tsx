import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { computeHireabilityGrade, type CandidateWithGradeRelations } from '@/lib/scoring/hireability-grade'
import { LockedFeatureNotice } from '@/components/dashboard/LockedFeatureNotice'
import { captureServerEvent } from '@/lib/posthog/server'

const POSTING_TYPE_LABEL: Record<string, string> = {
  direct: 'Direct Employer',
  recruiter_search: 'Recruiter-Led Search',
}

export default async function JobBoardPage() {
  const profile = await getDashboardData()
  const grade = await computeHireabilityGrade(profile as unknown as CandidateWithGradeRelations)
  const currentGrade = grade.searchExecution.grade
  const unlocked = currentGrade === 'A' && profile.recruiterDatabaseOptIn

  if (!unlocked) {
    const requirement = !profile.recruiterDatabaseOptIn
      ? "Requires an A Search Action Grade and recruiter database opt-in (Privacy settings) — you haven't opted in yet."
      : 'Requires an A Search Action Grade this week — hit an A to unlock verified, named-contact, freshness-enforced listings.'
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">NC Job Board</h1>
          <p className="mt-1 text-muted-foreground">
            Real postings only — every listing here has a named contact, a real salary band, is
            reviewed by a person before it goes live, and expires after 30 days unless the poster
            confirms the role is still open.
          </p>
        </div>
        <LockedFeatureNotice title="NC Job Board" requirement={requirement} currentGrade={currentGrade} />
      </div>
    )
  }

  const postings = await prisma.exclusiveJobPosting.findMany({
    where: {
      status: 'approved',
      archivedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: 'desc' },
  })

  captureServerEvent(profile.id, 'job_board_viewed', { count: postings.length })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">NC Job Board</h1>
        <p className="mt-1 text-muted-foreground">
          Every listing here has a named contact, a real salary band, and is reviewed by a person
          before it goes live — postings expire after 30 days unless the poster confirms the role
          is still open.
        </p>
      </div>

      {postings.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing posted right now — check back soon.</p>
      ) : (
        <div className="space-y-3">
          {postings.map((posting) => (
            <div key={posting.id} className="rounded-lg border border-border bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium text-foreground">
                  {posting.title} <span className="text-muted-foreground">at {posting.companyName}</span>
                </p>
                {posting.postingType && (
                  <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold tracking-wide text-brand uppercase">
                    {POSTING_TYPE_LABEL[posting.postingType] ?? posting.postingType}
                  </span>
                )}
              </div>
              {posting.location && <p className="text-sm text-muted-foreground">{posting.location}</p>}
              {posting.salaryMin && posting.salaryMax && (
                <p className="mt-1 text-sm font-medium text-foreground">
                  {posting.salaryCurrency ?? 'USD'} {posting.salaryMin.toLocaleString()}–
                  {posting.salaryMax.toLocaleString()}
                </p>
              )}
              {posting.contactName && (
                <p className="mt-1 text-sm text-muted-foreground">Contact: {posting.contactName}</p>
              )}
              {posting.description && <p className="mt-1 text-sm text-muted-foreground">{posting.description}</p>}
              <a
                href={posting.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-sm text-primary underline underline-offset-4"
              >
                View posting
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
