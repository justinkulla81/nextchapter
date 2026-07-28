import type { ExclusiveJobPosting } from '@prisma/client'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import {
  createExclusiveJobPosting,
  archiveExclusiveJobPosting,
  approveJobPosting,
  rejectJobPosting,
  reconfirmJobPostingAdmin,
  approveAllPendingJobPostings,
  approveAllPendingForCompany,
} from './actions'
import { ExclusiveJobPostingForm } from '@/components/admin/ExclusiveJobPostingForm'
import { ConfirmForm } from '@/components/admin/ConfirmForm'
import { Card, CardContent } from '@/components/ui/card'
import { SubmitButton } from '@/components/ui/submit-button'
import { Input } from '@/components/ui/input'
import { countPendingJobMatches } from '@/lib/jobs/job-fit-bucket'
import { displayJobLocation } from '@/lib/jobs/us-location'

export const maxDuration = 30

const SOURCE_LABEL: Record<string, string> = {
  admin: 'Added by admin',
  employer: 'Employer submission',
  recruiter: 'Recruiter submission',
  ats_feed: 'ATS feed',
}

const AUDIENCE_TIER_LABEL: Record<string, string> = {
  ALL_CANDIDATES: 'All candidates',
  A_LIST_ONLY: 'A-List only',
}

const DISTRIBUTION_LABEL: Record<string, string> = {
  OPEN: 'Open',
  TARGETED: 'Targeted',
  EXCLUDED: 'Excluded from board',
}

function visibilitySummary(posting: { audienceTier: string; distribution: string; disclosure: string }) {
  const parts = [
    AUDIENCE_TIER_LABEL[posting.audienceTier] ?? posting.audienceTier,
    DISTRIBUTION_LABEL[posting.distribution] ?? posting.distribution,
  ]
  if (posting.disclosure === 'CONFIDENTIAL') parts.push('Confidential — company hidden from candidates')
  return parts.join(' · ')
}

function PostingCard({
  posting,
  matched,
  total,
}: {
  posting: ExclusiveJobPosting
  matched: number
  total: number
}) {
  const missing: string[] = []
  if (!posting.contactName) missing.push('named contact')
  if (!posting.salaryMin || !posting.salaryMax) missing.push('salary band')
  const location = displayJobLocation(posting.location)

  return (
    <Card key={posting.id}>
      <CardContent className="space-y-3 pt-6">
        <div>
          <p className="font-medium">
            {posting.title} <span className="text-muted-foreground">at {posting.companyName}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {SOURCE_LABEL[posting.source]} · {posting.createdAt.toLocaleDateString()}
          </p>
          {location && <p className="text-sm text-muted-foreground">{location}</p>}
          <a
            href={posting.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline underline-offset-4"
          >
            View posting
          </a>
          <p className="mt-1 text-sm text-foreground">
            {posting.postingType === 'recruiter_search' ? 'Recruiter-led search' : 'Direct employer'} ·{' '}
            {posting.contactName ?? 'No named contact'}
            {posting.contactEmail ? ` (${posting.contactEmail})` : ''}
          </p>
          <p className="text-sm text-foreground">
            {posting.salaryMin && posting.salaryMax
              ? `${posting.salaryCurrency ?? 'USD'} ${posting.salaryMin.toLocaleString()}–${posting.salaryMax.toLocaleString()}`
              : 'No salary band'}
          </p>
          <p className="text-xs text-muted-foreground">{visibilitySummary(posting)}</p>
          <p className="text-sm font-medium text-foreground">
            Matches {matched} of {total} candidates
          </p>
          {posting.disclosure === 'CONFIDENTIAL' && (
            <p className="text-xs font-medium text-warning">
              Confidential — double-check {posting.companyName} is a real client before approving.
            </p>
          )}
          {missing.length > 0 && (
            <p className="mt-1 text-sm font-medium text-destructive">
              Missing: {missing.join(', ')} — needs manual follow-up before approving
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <form action={approveJobPosting.bind(null, posting.id)}>
            <SubmitButton size="sm" pendingLabel="Approving…">
              Approve
            </SubmitButton>
          </form>
          <form action={rejectJobPosting.bind(null, posting.id)} className="flex items-center gap-2">
            <Input name="rejectionReason" placeholder="Reason (optional)" className="h-8 max-w-xs" />
            <SubmitButton variant="destructive" size="sm" pendingLabel="Rejecting…">
              Reject
            </SubmitButton>
          </form>
        </div>
      </CardContent>
    </Card>
  )
}

async function loadPageData() {
  const [postings, candidates] = await Promise.all([
    prisma.exclusiveJobPosting.findMany({
      orderBy: { createdAt: 'desc' },
    }),
    prisma.candidateProfile.findMany({
      select: {
        primaryFunction: true,
        highestLevelReached: true,
        remotePreference: true,
        currentCity: true,
        openToRelocation: true,
        targetCompMin: true,
        compFlexible: true,
        targetRoleType: true,
        resumeKeywords: true,
      },
    }),
  ])
  const pending = postings.filter((p) => p.status === 'pending' && !p.archivedAt)
  const active = postings.filter((p) => p.status === 'approved' && !p.archivedAt)
  const archived = postings.filter((p) => p.archivedAt || p.status === 'rejected')
  return { pending, active, archived, candidates }
}

export default async function ExclusiveJobsAdminPage() {
  await requireAdmin()

  const { pending, active, archived, candidates } = await loadPageData()

  // Computed once, reused by both the "by company" and "by fit" views below
  // so a posting's match count is never recalculated twice per render.
  const pendingWithFit = pending.map((posting) => ({
    posting,
    ...countPendingJobMatches(posting, candidates),
  }))

  // Grouped by company so a company with many pending listings (common from
  // the ATS feed) doesn't force scrolling past all of them to reach the
  // next company — collapsed by default, expand whichever's worth a look.
  const pendingByCompany = new Map<string, typeof pendingWithFit>()
  for (const row of pendingWithFit) {
    const group = pendingByCompany.get(row.posting.companyName) ?? []
    group.push(row)
    pendingByCompany.set(row.posting.companyName, group)
  }
  const pendingCompanies = Array.from(pendingByCompany.entries()).sort((a, b) => b[1].length - a[1].length)

  // Sorted by match count — the postings most candidates could actually
  // fill, regardless of which company they're at, surface first. Ties break
  // on recency so a fresh listing doesn't get buried behind a stale one with
  // the same match count.
  const pendingByFit = [...pendingWithFit].sort((a, b) => {
    if (b.matched !== a.matched) return b.matched - a.matched
    return b.posting.createdAt.getTime() - a.posting.createdAt.getTime()
  })

  const archivedByCompany = new Map<string, typeof archived>()
  for (const posting of archived) {
    const group = archivedByCompany.get(posting.companyName) ?? []
    group.push(posting)
    archivedByCompany.set(posting.companyName, group)
  }
  const archivedCompanies = Array.from(archivedByCompany.entries()).sort((a, b) => b[1].length - a[1].length)

  return (
    <div className="mx-auto max-w-3xl space-y-10 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Job Board</h1>
        <p className="mt-1 text-muted-foreground">
          Every non-admin submission lands here as pending until approved — no employer/recruiter
          domain verification exists yet, so this review is the trust gate. Visible only to
          candidates currently holding an A Market Reality Grade and opted into the recruiter
          database. Limited to US-based roles.
        </p>
      </div>

      <details className="rounded-lg border border-border">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
          + Add a job manually
        </summary>
        <div className="border-t border-border p-4">
          <ExclusiveJobPostingForm action={createExclusiveJobPosting} />
        </div>
      </details>

      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-medium text-muted-foreground">Pending review ({pending.length})</h2>
          {pending.length > 0 && (
            <ConfirmForm
              action={approveAllPendingJobPostings}
              confirmMessage={`Approve all ${pending.length} pending postings? They'll become visible to eligible candidates immediately.`}
            >
              <SubmitButton size="sm" variant="outline" pendingLabel="Approving all…">
                Approve all ({pending.length})
              </SubmitButton>
            </ConfirmForm>
          )}
        </div>

        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing waiting on review.</p>
        ) : (
          <>
            <div className="space-y-3">
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">By company</h3>
              {pendingCompanies.map(([companyName, rows]) => (
                <details key={companyName} className="rounded-lg border border-border">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
                    <span>
                      {companyName} <span className="font-normal text-muted-foreground">({rows.length} pending)</span>
                    </span>
                  </summary>
                  <div className="space-y-3 border-t border-border p-3">
                    <ConfirmForm
                      action={approveAllPendingForCompany.bind(null, companyName)}
                      confirmMessage={`Approve all ${rows.length} pending ${companyName} postings? They'll become visible to eligible candidates immediately.`}
                    >
                      <SubmitButton size="sm" variant="outline" pendingLabel="Approving…">
                        Approve all for {companyName} ({rows.length})
                      </SubmitButton>
                    </ConfirmForm>
                    {rows.map(({ posting, matched, total }) => (
                      <PostingCard key={posting.id} posting={posting} matched={matched} total={total} />
                    ))}
                  </div>
                </details>
              ))}
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">By fit</h3>
              <p className="text-xs text-muted-foreground">
                Sorted by how many candidates in the pool are a plausible match — highest first.
              </p>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-muted/50 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    <tr>
                      <th className="px-3 py-2">Matches</th>
                      <th className="px-3 py-2">Role</th>
                      <th className="px-3 py-2">Location</th>
                      <th className="px-3 py-2">Salary</th>
                      <th className="px-3 py-2">Posted</th>
                      <th className="px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingByFit.map(({ posting, matched, total }) => {
                      const location = displayJobLocation(posting.location)
                      return (
                        <tr key={posting.id} className="border-t border-border align-top">
                          <td className="px-3 py-3 font-medium whitespace-nowrap text-foreground">
                            {matched} of {total}
                          </td>
                          <td className="px-3 py-3">
                            <a
                              href={posting.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-primary underline underline-offset-4"
                            >
                              {posting.title}
                            </a>
                            <p className="text-xs text-muted-foreground">{posting.companyName}</p>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">{location ?? '—'}</td>
                          <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">
                            {posting.salaryMin && posting.salaryMax
                              ? `${posting.salaryCurrency ?? 'USD'} ${posting.salaryMin.toLocaleString()}–${posting.salaryMax.toLocaleString()}`
                              : 'No band'}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">
                            {posting.createdAt.toLocaleDateString()}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <form action={approveJobPosting.bind(null, posting.id)}>
                                <SubmitButton size="sm" pendingLabel="Approving…">
                                  Approve
                                </SubmitButton>
                              </form>
                              <form action={rejectJobPosting.bind(null, posting.id)}>
                                <SubmitButton variant="destructive" size="sm" pendingLabel="Rejecting…">
                                  Reject
                                </SubmitButton>
                              </form>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Active ({active.length})</h2>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active postings yet.</p>
        ) : (
          active.map((posting) => {
            const location = displayJobLocation(posting.location)
            return (
              <Card key={posting.id}>
                <CardContent className="flex items-start justify-between gap-4 pt-6">
                  <div>
                    <p className="font-medium">
                      {posting.title} <span className="text-muted-foreground">at {posting.companyName}</span>
                    </p>
                    {location && <p className="text-sm text-muted-foreground">{location}</p>}
                    <a
                      href={posting.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary underline underline-offset-4"
                    >
                      View posting
                    </a>
                    {posting.description && <p className="mt-1 text-sm text-muted-foreground">{posting.description}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {SOURCE_LABEL[posting.source]} · added by {posting.addedBy} · {posting.createdAt.toLocaleDateString()}
                      {posting.expiresAt && ` · expires ${posting.expiresAt.toLocaleDateString()}`}
                    </p>
                    <p className="text-xs text-muted-foreground">{visibilitySummary(posting)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {posting.expiresAt && (
                      <form action={reconfirmJobPostingAdmin.bind(null, posting.id)}>
                        <SubmitButton variant="outline" size="sm" pendingLabel="Confirming…">
                          Still open — confirm
                        </SubmitButton>
                      </form>
                    )}
                    <form action={archiveExclusiveJobPosting.bind(null, posting.id)}>
                      <SubmitButton variant="ghost" size="sm">
                        Archive
                      </SubmitButton>
                    </form>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {archived.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Archived / rejected ({archived.length})</h2>
          {archivedCompanies.map(([companyName, companyPostings]) => (
            <details key={companyName} className="rounded-lg border border-border">
              <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
                {companyName}{' '}
                <span className="font-normal text-muted-foreground">
                  ({companyPostings.length} archived/rejected)
                </span>
              </summary>
              <div className="space-y-1 border-t border-border p-3">
                {companyPostings.map((posting) => (
                  <p key={posting.id} className="text-sm text-muted-foreground">
                    {posting.title}
                    {posting.status === 'rejected' && ' — rejected'}
                    {posting.rejectionReason && `: ${posting.rejectionReason}`}
                  </p>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  )
}
