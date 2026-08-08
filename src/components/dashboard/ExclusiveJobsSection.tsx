import { LockedFeatureNotice } from '@/components/dashboard/LockedFeatureNotice'
import type { Grade } from '@/lib/scoring/grade'

interface ExclusivePosting {
  id: string
  title: string
  companyName: string
  location: string | null
  url: string
  description: string | null
}

export function ExclusiveJobsSection({
  currentGrade,
  recruiterDatabaseOptIn,
  postings,
}: {
  currentGrade: Grade
  recruiterDatabaseOptIn: boolean
  postings: ExclusivePosting[]
}) {
  const unlocked = currentGrade === 'A' && recruiterDatabaseOptIn

  if (!unlocked) {
    const requirement = !recruiterDatabaseOptIn
      ? 'Requires an A Current Market Reality and recruiter database opt-in (Privacy settings) — you haven\'t opted in yet.'
      : 'Requires an A Current Market Reality — real, admin-curated postings only shown to candidates currently holding one.'
    return (
      <LockedFeatureNotice title="Exclusive Next Chapter Jobs" requirement={requirement} currentGrade={currentGrade} />
    )
  }

  return (
    <div className="space-y-3 rounded-lg border border-brand/30 bg-brand/5 p-4">
      <div>
        <p className="text-sm font-semibold text-foreground">Exclusive Next Chapter Jobs — unlocked</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Real postings, curated for candidates holding an A Current Market Reality.
        </p>
      </div>
      {postings.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing posted right now — check back soon.</p>
      ) : (
        <div className="space-y-2">
          {postings.map((posting) => (
            <div key={posting.id} className="rounded-md border border-border bg-white p-3">
              <p className="font-medium text-foreground">
                {posting.title} <span className="text-muted-foreground">at {posting.companyName}</span>
              </p>
              {posting.location && <p className="text-sm text-muted-foreground">{posting.location}</p>}
              {posting.description && <p className="mt-1 text-sm text-muted-foreground">{posting.description}</p>}
              <a
                href={posting.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-sm text-primary underline underline-offset-4"
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
