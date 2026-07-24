import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import {
  createExclusiveJobPosting,
  archiveExclusiveJobPosting,
  approveJobPosting,
  rejectJobPosting,
  reconfirmJobPostingAdmin,
} from './actions'
import { ExclusiveJobPostingForm } from '@/components/admin/ExclusiveJobPostingForm'
import { Card, CardContent } from '@/components/ui/card'
import { SubmitButton } from '@/components/ui/submit-button'
import { Input } from '@/components/ui/input'

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

export default async function ExclusiveJobsAdminPage() {
  await requireAdmin()

  const postings = await prisma.exclusiveJobPosting.findMany({
    orderBy: { createdAt: 'desc' },
  })
  const pending = postings.filter((p) => p.status === 'pending' && !p.archivedAt)
  const active = postings.filter((p) => p.status === 'approved' && !p.archivedAt)
  const archived = postings.filter((p) => p.archivedAt || p.status === 'rejected')

  return (
    <div className="mx-auto max-w-3xl space-y-10 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Job Board</h1>
        <p className="mt-1 text-muted-foreground">
          Every non-admin submission lands here as pending until approved — no employer/recruiter
          domain verification exists yet, so this review is the trust gate. Visible only to
          candidates currently holding an A Market Reality Grade and opted into the recruiter
          database.
        </p>
      </div>

      <ExclusiveJobPostingForm action={createExclusiveJobPosting} />

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Pending review ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing waiting on review.</p>
        ) : (
          pending.map((posting) => {
            const missing: string[] = []
            if (!posting.contactName) missing.push('named contact')
            if (!posting.salaryMin || !posting.salaryMax) missing.push('salary band')
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
                    {posting.location && <p className="text-sm text-muted-foreground">{posting.location}</p>}
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
          })
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Active ({active.length})</h2>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active postings yet.</p>
        ) : (
          active.map((posting) => (
            <Card key={posting.id}>
              <CardContent className="flex items-start justify-between gap-4 pt-6">
                <div>
                  <p className="font-medium">
                    {posting.title} <span className="text-muted-foreground">at {posting.companyName}</span>
                  </p>
                  {posting.location && <p className="text-sm text-muted-foreground">{posting.location}</p>}
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
          ))
        )}
      </div>

      {archived.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Archived / rejected ({archived.length})</h2>
          <div className="space-y-1">
            {archived.map((posting) => (
              <p key={posting.id} className="text-sm text-muted-foreground">
                {posting.title} at {posting.companyName}
                {posting.status === 'rejected' && ' — rejected'}
                {posting.rejectionReason && `: ${posting.rejectionReason}`}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
