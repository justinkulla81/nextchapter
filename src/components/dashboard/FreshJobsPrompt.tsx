import type { CandidateProfile } from '@prisma/client'
import { getFreshJobsPeek, FRESH_PEEK_COUNT_CAP } from '@/lib/jobs/fresh-jobs-peek'
import { postedAgo } from '@/lib/jobs/competition'
import { TrackedLink } from '@/components/dashboard/TrackedLink'

/**
 * Dashboard prompt: new jobs in the member's field from the last 72 hours — the window
 * when an application gets the most attention. A small query, not the ranked board
 * (fresh-jobs-peek.ts); the Jobs board has the full, ranked list.
 */
export async function FreshJobsPrompt({ profile }: { profile: CandidateProfile }) {
  const { count, top } = await getFreshJobsPeek(profile.primaryFunction, profile.secondaryFunction)
  if (count === 0) return null
  const total = count >= FRESH_PEEK_COUNT_CAP ? `${FRESH_PEEK_COUNT_CAP}+` : String(count)

  return (
    <div className="rounded-lg border border-orange/40 bg-orange/10 p-4">
      <p className="text-sm font-semibold text-foreground">
        {total} new job{count === 1 ? '' : 's'} in your field — posted in the last 72 hours
      </p>
      <p className="mt-1 text-sm text-muted-foreground">Early applicants get most of the interviews. Apply to these first.</p>
      <ul className="mt-2 space-y-1 text-sm">
        {top.map((p) => (
          <li key={p.id} className="text-foreground">
            {p.title}
            <span className="text-muted-foreground">
              {p.disclosure === 'CONFIDENTIAL' ? ' · Confidential search' : ` · ${p.companyName}`} · {postedAgo(p)}
            </span>
          </li>
        ))}
      </ul>
      <TrackedLink
        href="/dashboard/find-my-job?view=fresh#job-recommendations"
        event="fresh_jobs_prompt_clicked"
        properties={{ count }}
        className="mt-3 inline-block text-sm font-medium text-primary underline underline-offset-4"
      >
        See new jobs and apply
      </TrackedLink>
    </div>
  )
}
