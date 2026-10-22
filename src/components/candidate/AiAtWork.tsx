import { ExposureCredit, ExposureFact, JobsByExposure } from '@/components/candidate/AiExposure'
import { ExposureShown } from '@/components/candidate/ExposureShown'
import { TrackedLink } from '@/components/dashboard/TrackedLink'
import { RETRAINING_LINE, retrainingNeed } from '@/lib/skills/ai-exposure'
import type { AiAtWork as AiAtWorkData } from '@/lib/skills/ai-at-work'

export const AI_AT_WORK_TITLE = 'AI at work, for the roles you are going after'
const LEARN_LINK = 'text-sm font-medium text-ink underline underline-offset-4'

/**
 * The member's occupation exposure, the split of openings in their target field, and the one retraining line with its
 * single link to Learn. One credit line for the whole box. Nothing at all when there is no data.
 */
export function AiAtWorkBlock({ data, surface, heading = true }: { data: AiAtWorkData | null; surface: string; heading?: boolean }) {
  if (!data) return null
  const { exposure, split } = data
  const need = retrainingNeed(exposure)
  return (
    <div className="space-y-4 rounded-xl bg-muted/70 p-4">
      <ExposureShown surface={surface} {...data.event} />
      {heading && <p className="text-base font-semibold text-ink">{AI_AT_WORK_TITLE}</p>}
      {exposure && <ExposureFact exposure={exposure} credit={false} />}
      {split && <JobsByExposure split={split} label="Openings we see by AI exposure" credit={false} />}
      <p className="text-base text-ink">
        {RETRAINING_LINE[need]}{' '}
        <TrackedLink href="/dashboard/learning" event="ai_exposure_learn_clicked" properties={{ surface, soc6: exposure?.soc6 ?? null, band: exposure?.band ?? null, need }} className={LEARN_LINK}>
          Find AI courses
        </TrackedLink>
      </p>
      <ExposureCredit />
    </div>
  )
}
