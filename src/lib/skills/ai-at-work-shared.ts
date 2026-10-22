import type { ExposureBand, JobsByExposure, OccupationExposure } from '@/lib/skills/ai-exposure'

// Pure helpers for the "AI at work" block, shared by the server loader and the client event.

export type ExposureEventProps = { surface: string; soc6: string | null; band: ExposureBand | null; hasSplit: boolean }

/** The PostHog `ai_exposure_shown` properties, minus the surface. */
export function exposureEventProps(exposure: Pick<OccupationExposure, 'soc6' | 'band'> | null, split: Pick<JobsByExposure, 'measured'> | null): Omit<ExposureEventProps, 'surface'> {
  return { soc6: exposure?.soc6 ?? null, band: exposure?.band ?? null, hasSplit: Boolean(split && split.measured > 0) }
}
