import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { SubmitButton } from '@/components/ui/submit-button'
import { REVIEW_MEMBER_FLAGS } from '@/lib/jobs/ghost-risk'
import { decideJobFlags, markJobFlagsReviewed } from './actions'

export const maxDuration = 30

const KIND_LABEL: Record<string, string> = { ghost: 'Ghost job', too_good: 'Too good to be true', red_flags: 'Red flags' }

// Board jobs members passed on as a ghost job, too good to be true, or with red flags
// (the X on a job card, src/lib/jobs/job-dismiss.ts). A flag hides the job for the member
// who flagged it; REVIEW_MEMBER_FLAGS of them queue it here, first. "Confirm ghost" hides it
// for everyone (ghost-risk.ts); "Dismiss" keeps it.
export default async function JobFlagsAdminPage() {
  await requireAdmin()
  const flags = await prisma.jobPostingFlag.findMany({ where: { reviewedAt: null }, orderBy: { createdAt: 'desc' }, take: 500 })
  const postingIds = [...new Set(flags.map((f) => f.postingId))]
  const postings = await prisma.exclusiveJobPosting.findMany({
    where: { id: { in: postingIds } },
    select: { id: true, title: true, companyName: true, url: true, archivedAt: true },
  })
  const byId = new Map(postings.map((p) => [p.id, p]))
  const grouped = postingIds.map((id) => ({ id, posting: byId.get(id), flags: flags.filter((f) => f.postingId === id) }))
  grouped.sort((a, b) => b.flags.length - a.flags.length)

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Job flags</h1>
        <p className="mt-1 text-muted-foreground">
          Jobs members passed on as a ghost job, too good to be true, or with red flags — {grouped.length} job
          {grouped.length === 1 ? '' : 's'} waiting for review. A flag hides the job only for the member who flagged it; jobs with {REVIEW_MEMBER_FLAGS}+ flags are
          queued first. Confirm ghost to hide a job for everyone.
        </p>
      </div>
      {grouped.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing flagged.</p>
      ) : (
        <ul className="space-y-3">
          {grouped.map((g) => (
            <li key={g.id} className="space-y-2 rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">
                  {g.posting ? (
                    <a href={g.posting.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                      {g.posting.title} at {g.posting.companyName}
                    </a>
                  ) : (
                    `Posting ${g.id} (no longer on the board)`
                  )}
                  {g.posting?.archivedAt && <span className="text-muted-foreground"> · closed</span>}
                </p>
                <div className="flex flex-wrap gap-2">
                  {g.flags.length >= REVIEW_MEMBER_FLAGS && (
                    <span className="rounded-full bg-orange/15 px-2 py-0.5 text-xs font-medium text-foreground">Queued · {g.flags.length} flags</span>
                  )}
                  <form action={decideJobFlags}>
                    <input type="hidden" name="postingId" value={g.id} />
                    <input type="hidden" name="decision" value="confirmed_ghost" />
                    <SubmitButton size="sm" pendingLabel="Saving…">
                      Confirm ghost
                    </SubmitButton>
                  </form>
                  <form action={decideJobFlags}>
                    <input type="hidden" name="postingId" value={g.id} />
                    <input type="hidden" name="decision" value="dismissed" />
                    <SubmitButton variant="outline" size="sm" pendingLabel="Saving…">
                      Dismiss
                    </SubmitButton>
                  </form>
                  <form action={markJobFlagsReviewed}>
                    <input type="hidden" name="postingId" value={g.id} />
                    <SubmitButton variant="ghost" size="sm" pendingLabel="Saving…">
                      Red flags reviewed
                    </SubmitButton>
                  </form>
                </div>
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {g.flags.map((f) => (
                  <li key={f.id}>
                    <span className="font-medium text-foreground">{KIND_LABEL[f.kind] ?? f.kind}</span> ·{' '}
                    {f.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {f.note && ` · “${f.note}”`}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
