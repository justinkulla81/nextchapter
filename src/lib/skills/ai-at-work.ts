import 'server-only'
import { loadCandidateExposure, loadJobsByExposure } from '@/lib/skills/ai-exposure-server'
import { exposureEventProps, type ExposureEventProps } from '@/lib/skills/ai-at-work-shared'
import type { JobsByExposure, OccupationExposure } from '@/lib/skills/ai-exposure'

export type AiAtWork = {
  exposure: (OccupationExposure & { socCode: string }) | null
  split: JobsByExposure | null
  event: Omit<ExposureEventProps, 'surface'>
}

/**
 * "AI at work" for one member: their occupation's observed exposure and the split of openings in their target field
 * (`fn` is the function label loadMarketSize uses). Fails soft: null when there is nothing to show, never an error.
 */
export async function loadAiAtWork(candidateId: string, fn: string | null | undefined): Promise<AiAtWork | null> {
  try {
    const [exposure, split] = await Promise.all([loadCandidateExposure(candidateId), fn ? loadJobsByExposure(fn) : Promise.resolve(null)])
    if (!exposure && !split) return null
    return { exposure, split, event: exposureEventProps(exposure, split) }
  } catch (error) {
    console.error('AI at work unavailable:', error)
    return null
  }
}
