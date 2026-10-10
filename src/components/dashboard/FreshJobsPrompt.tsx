import type { CandidateProfile } from '@prisma/client'
import { isDossierUnlocked } from '@/lib/scoring/dossier-unlock'
import { loadBoardShortlist, postedWithinWhere } from '@/lib/jobs/board-shortlist'
import { FRESH_HOURS, postedAgo } from '@/lib/jobs/competition'
import { TrackedLink } from '@/components/dashboard/TrackedLink'

/**
 * Dashboard prompt: jobs that fit the member and were posted in the last 72
 * hours — the window when an application gets the most attention. Reads
 * only those 72 hours of the board, so it stays cheap.
 */
export async function FreshJobsPrompt({ profile }: { profile: CandidateProfile }) {
  const dossier = await isDossierUnlocked(profile.id)
  const board = await loadBoardShortlist({
    candidate: profile,
    isCandidatePlus: dossier.unlocked,
    where: postedWithinWhere(FRESH_HOURS),
    view: 'fresh',
    size: 3,
  })
  if (board.freshOpenTotal === 0) return null
  const top = board.open.slice(0, 3)

  return (
    <div className="rounded-lg border border-orange/40 bg-orange/10 p-4">
      <p className="text-sm font-semibold text-foreground">
        {board.freshOpenTotal} new job{board.freshOpenTotal === 1 ? '' : 's'} that fit you — posted in the last 72 hours
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
        properties={{ count: board.freshOpenTotal }}
        className="mt-3 inline-block text-sm font-medium text-primary underline underline-offset-4"
      >
        See all {board.freshOpenTotal} and apply
      </TrackedLink>
    </div>
  )
}
