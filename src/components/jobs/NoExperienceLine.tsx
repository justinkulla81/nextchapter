import { noExperienceQuote } from '@/lib/jobs/entry-filters'

/**
 * "No experience needed", with the posting's own words that triggered it (entry-filters.ts), on the open job and
 * the public job page. Nothing when the job is not flagged. Server-safe (no hooks).
 */
export function NoExperienceLine({
  jobId,
  signals,
  phrase,
  surface,
  className,
}: {
  jobId: string
  signals: readonly string[] | null | undefined
  phrase: string | null | undefined
  surface: string
  className?: string
}) {
  if (!(signals ?? []).includes('no_experience_ok')) return null
  const quote = noExperienceQuote(phrase)
  return (
    <p className={className ?? 'text-base text-ink'} data-no-experience={jobId} data-surface={surface}>
      <span className="font-semibold">No experience needed.</span>
      {quote ? <> The posting says: &ldquo;{quote}&rdquo;</> : ' The posting says people without experience are welcome.'}
    </p>
  )
}
