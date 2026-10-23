'use client'

import { useEffect } from 'react'
import { ExposureFact } from '@/components/candidate/AiExposure'
import { AI_EXPOSURE_SOURCE, type OccupationExposure } from '@/lib/skills/ai-exposure'
import type { JobAiView } from '@/lib/jobs/job-ai-view'
import { posthog } from '@/lib/posthog/client'

// "AI at work" on the open job (mockup: src/app/dev-preview/_mockups/ai-exposure.tsx): how much AI use is observed in
// the occupation this opening is placed in, and whether the posting itself asks for AI skills. No color codes it.
// Nothing shows when the job has neither (never a guess); a job that asks for AI skills in an occupation we have not
// measured says so. One credit line for the box.

export function JobAiExposure({ jobId, exposure, ai }: { jobId: string; exposure: OccupationExposure | null; ai: JobAiView | null }) {
  useEffect(() => {
    if (exposure) posthog.capture('ai_exposure_shown', { surface: 'job_detail', soc6: exposure.soc6, band: exposure.band, jobId, asksForAiSkills: !!ai })
    // Once per opened job: the pane is remounted for each one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!exposure && !ai) return null
  return (
    <section aria-labelledby={`ai-${jobId}`} className="space-y-3 rounded-xl bg-muted/40 p-4">
      <h3 id={`ai-${jobId}`} className="font-display text-lg font-semibold text-ink">
        AI at work
      </h3>
      {exposure ? <ExposureFact exposure={exposure} credit={false} /> : <p className="text-sm text-muted-foreground">We do not have an AI exposure measure for this occupation yet.</p>}
      {ai && (
        <div className="space-y-1">
          <p className="text-base text-ink">
            <span className="font-semibold">Asks for AI skills.</span>
            {ai.skills.length > 0 && ` ${ai.skills.join(', ')}${ai.more > 0 ? `, and ${ai.more} more` : ''}.`}
          </p>
          {ai.paySentence && <p className="text-sm text-ink">{ai.paySentence}</p>}
        </div>
      )}
      {exposure && (
        <p className="text-xs text-muted-foreground">
          Source:{' '}
          <a
            href={AI_EXPOSURE_SOURCE.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4"
            onClick={() => posthog.capture('ai_exposure_source_opened', { surface: 'job_detail', soc6: exposure.soc6, band: exposure.band, jobId })}
          >
            {AI_EXPOSURE_SOURCE.name}
          </a>
          , {AI_EXPOSURE_SOURCE.released}.
        </p>
      )}
    </section>
  )
}
