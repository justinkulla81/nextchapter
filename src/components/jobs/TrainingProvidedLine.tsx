import { noExperienceQuote } from '@/lib/jobs/entry-filters'

/**
 * "Training provided", with the posting's own words that triggered it (entry-filters.ts), on the open job and the
 * public job page, next to NoExperienceLine. Nothing when the job is not flagged. Server-safe (no hooks).
 */
export function TrainingProvidedLine({
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
  if (!(signals ?? []).includes('training_provided')) return null
  const quote = noExperienceQuote(phrase)
  return (
    <p className={className ?? 'text-base text-ink'} data-training-provided={jobId} data-surface={surface}>
      <span className="font-semibold">Training provided.</span>
      {quote ? <> The posting says: &ldquo;{quote}&rdquo;</> : ' The posting describes a training program for new hires.'}
    </p>
  )
}
