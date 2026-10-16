import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { SubmitButton } from '@/components/ui/submit-button'
import { LIKELY_MEMBER_FLAGS } from '@/lib/jobs/ghost-risk'
import { markJobFlagsReviewed } from './actions'

export const maxDuration = 30

const KIND_LABEL: Record<string, string> = { ghost: 'Ghost job', too_good: 'Too good to be true', red_flags: 'Red flags' }

// Board jobs members passed on as a ghost job, too good to be true, or with red flags
// (the X on a job card, src/lib/jobs/job-dismiss.ts). Ghost / too-good flags also feed
// ghost risk: LIKELY_MEMBER_FLAGS of them keep a job off every board.
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
          {grouped.length === 1 ? '' : 's'} waiting for review. {LIKELY_MEMBER_FLAGS}+ ghost or too-good flags already keep a job off every member&apos;s board.
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
                <form action={markJobFlagsReviewed}>
                  <input type="hidden" name="postingId" value={g.id} />
                  <SubmitButton variant="outline" size="sm" pendingLabel="Saving…">
                    Mark reviewed
                  </SubmitButton>
                </form>
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
