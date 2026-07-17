import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { createExclusiveJobPosting, archiveExclusiveJobPosting } from './actions'
import { ExclusiveJobPostingForm } from '@/components/admin/ExclusiveJobPostingForm'
import { Card, CardContent } from '@/components/ui/card'
import { SubmitButton } from '@/components/ui/submit-button'

export const maxDuration = 30

export default async function ExclusiveJobsAdminPage() {
  await requireAdmin()

  const postings = await prisma.exclusiveJobPosting.findMany({
    orderBy: { createdAt: 'desc' },
  })
  const active = postings.filter((p) => !p.archivedAt)
  const archived = postings.filter((p) => p.archivedAt)

  return (
    <div className="mx-auto max-w-3xl space-y-10 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Exclusive Next Chapter Jobs</h1>
        <p className="mt-1 text-muted-foreground">
          Real postings only — every listing here is a real one you&apos;ve chosen to feature. Visible only to
          candidates currently holding an A Search Action Grade and opted into the recruiter database.
        </p>
      </div>

      <ExclusiveJobPostingForm action={createExclusiveJobPosting} />

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Active ({active.length})</h2>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">No exclusive postings yet.</p>
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
                    Added by {posting.addedBy} · {posting.createdAt.toLocaleDateString()}
                  </p>
                </div>
                <form action={archiveExclusiveJobPosting.bind(null, posting.id)}>
                  <SubmitButton variant="ghost" size="sm">
                    Archive
                  </SubmitButton>
                </form>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {archived.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Archived ({archived.length})</h2>
          <div className="space-y-1">
            {archived.map((posting) => (
              <p key={posting.id} className="text-sm text-muted-foreground">
                {posting.title} at {posting.companyName}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
