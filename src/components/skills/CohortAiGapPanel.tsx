import Link from 'next/link'
import type { CohortAiGap } from '@/lib/skills/cohort-ai-gap'
import { cohortAiGapHeadline } from '@/lib/skills/cohort-ai-gap'
import { CRAWLER_FUNCTION_LABEL } from '@/lib/jobs/job-functions'
import { AI_MARKET_AS_OF } from '@/lib/skills/ai-skill-market.data'

// One AI-skills block for an employer, college or board report. Counts only; the caller
// has already held it back below 10 people. Says what the number is and is not: the
// profile is what people told us, and the postings are what employers asked for.
export function CohortAiGapPanel({ gap, who }: { gap: CohortAiGap | null; who: string }) {
  return (
    <section aria-labelledby="cohort-ai-gap" className="space-y-3">
      <h2 id="cohort-ai-gap" className="text-lg font-semibold">
        AI skills
      </h2>
      {gap === null ? (
        <p className="text-sm text-muted-foreground">Shown once at least 10 {who} have a function we can compare against job postings.</p>
      ) : (
        <>
          <p className="max-w-2xl text-sm text-foreground">{cohortAiGapHeadline(gap)}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Show at least one AI skill</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {gap.showAnyAi}
                <span className="text-sm font-normal text-muted-foreground"> of {gap.counted}</span>
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Missing one of the 3 AI skills their function asks for most</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {gap.missingAsked}
                <span className="text-sm font-normal text-muted-foreground"> of {gap.counted}</span>
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Most often missing</p>
              {gap.topMissing.length === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">No single skill reaches 10 people.</p>
              ) : (
                <ul className="mt-1 space-y-0.5 text-sm">
                  {gap.topMissing.map((m) => (
                    <li key={m.id} className="tabular-nums">
                      {m.label} <span className="text-muted-foreground">· {m.people}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          {gap.functions.length > 0 && (
            <p className="max-w-2xl text-xs text-muted-foreground">
              Share of job postings that ask for an AI skill, for the largest functions here:{' '}
              {gap.functions.map((f) => `${CRAWLER_FUNCTION_LABEL[f.fn] ?? f.fn} ${f.postingsAskingPct}%`).join(', ')}.
            </p>
          )}
          <p className="max-w-2xl text-xs text-muted-foreground">
            “On their profile” means skills people added, confirmed or have on their résumé, so it can understate what they know. Postings data is as of {AI_MARKET_AS_OF}.{' '}
            <Link href="/ai-skills" className="underline underline-offset-4">
              How AI skills show up in postings and pay
            </Link>
          </p>
        </>
      )}
    </section>
  )
}
