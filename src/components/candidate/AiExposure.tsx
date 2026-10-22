import { AI_EXPOSURE_SOURCE, BAND_LABEL, EXPOSURE_WHY, exposureSentence, scorePercent, type ExposureBand, type JobsByExposure, type OccupationExposure } from '@/lib/skills/ai-exposure'
import { Chip } from '@/components/candidate/ui'

// Anthropic Economic Index "observed exposure", drawn the same way on every candidate page that shows it (market
// report, search strategy, pivots, learning). No color codes the bands: a high number is information, not an alarm,
// and the one orange on a page is for its action. The credit is one line, the way O*NET and BLS are credited.

/** A small tag for a row: "AI exposure: Some". */
export function ExposureTag({ exposure }: { exposure: OccupationExposure }) {
  return <Chip>{`AI exposure: ${BAND_LABEL[exposure.band]}`}</Chip>
}

/** The one-line credit under any exposure figure. */
export function ExposureCredit() {
  return (
    <p className="text-xs text-muted-foreground">
      Source: <a href={AI_EXPOSURE_SOURCE.url} className="underline underline-offset-4">{AI_EXPOSURE_SOURCE.name}</a>, {AI_EXPOSURE_SOURCE.released}.
    </p>
  )
}

/** One occupation: what is happening, the number with its band, why we say it, and the credit. */
export function ExposureFact({ exposure }: { exposure: OccupationExposure }) {
  return (
    <div className="space-y-2">
      <p className="text-base text-ink">{exposureSentence(exposure)}</p>
      <div className="flex items-center gap-3">
        <div className="h-1.5 w-40 overflow-hidden rounded-full bg-border" role="meter" aria-valuenow={Math.round(exposure.score * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`Observed AI exposure, ${scorePercent(exposure.score)}`}>
          <div className="h-full rounded-full bg-ink" style={{ width: `${Math.max(2, Math.round(exposure.score * 100))}%` }} />
        </div>
        <span className="text-sm font-semibold text-ink">{BAND_LABEL[exposure.band]}</span>
        <span className="text-sm text-muted-foreground">{scorePercent(exposure.score)}</span>
      </div>
      <p className="text-sm text-muted-foreground">{EXPOSURE_WHY}</p>
      <ExposureCredit />
    </div>
  )
}

const SEGMENTS: { band: ExposureBand; className: string }[] = [
  { band: 'high', className: 'bg-ink' },
  { band: 'some', className: 'bg-ink/50' },
  { band: 'little', className: 'bg-ink/15' },
]

/** The jobs we see, split by how much AI use is observed in their occupation, with how much of the market that covers. */
export function JobsByExposure({ split, label }: { split: JobsByExposure; label: string }) {
  if (!split.measured) return null
  const pct = (n: number) => `${Math.round(n * 100)}%`
  return (
    <div className="space-y-2">
      <div className="flex h-3 overflow-hidden rounded-full bg-border" role="img" aria-label={`${label}: ${SEGMENTS.map((s) => `${pct(split.shares[s.band])} ${BAND_LABEL[s.band].toLowerCase()}`).join(', ')}`}>
        {SEGMENTS.map((s) => (
          <div key={s.band} className={s.className} style={{ width: `${split.shares[s.band] * 100}%` }} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink">
        {SEGMENTS.map((s) => (
          <li key={s.band} className="flex items-center gap-2">
            <span aria-hidden className={`inline-block size-2.5 rounded-full ${s.className}`} />
            <span className="font-semibold">{pct(split.shares[s.band])}</span> {BAND_LABEL[s.band].toLowerCase()}
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">
        Of the {split.measured.toLocaleString('en-US')} openings we could place in an occupation ({pct(split.coverage)} of all openings we see). Openings we could not place are not counted.
      </p>
      <ExposureCredit />
    </div>
  )
}
