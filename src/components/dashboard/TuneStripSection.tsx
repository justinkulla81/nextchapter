import type { CandidateProfile } from '@prisma/client'
import { computeMatchState } from '@/lib/personalization/match-compute'
import { signalInputsFor } from '@/lib/personalization/know-you'
import { buildSignals, precisionOf } from '@/lib/personalization/signals'
import { TuneStrip } from '@/components/candidate/TuneStrip'

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

/**
 * "Better jobs for you": the first strip on Find a job, from the member's real match run. It says how tuned the search
 * is, names up to two answers that would sharpen it and what each would add, and sends them to Improve your search.
 * Wrap in Suspense; shows nothing when matching has no basis.
 */
export async function TuneStripSection({ profile }: { profile: CandidateProfile }) {
  const state = await computeMatchState(profile, { live: true }).catch((error) => {
    console.error('Tune strip unavailable:', error)
    return null
  })
  if (!state) return null
  const signals = buildSignals(signalInputsFor(profile, state))
  const { pct } = precisionOf(signals)
  const missing = signals.filter((s) => !s.known && s.weight > 0).sort((a, b) => b.weight - a.weight)
  const known = signals.filter((s) => s.known).map((s) => s.label)
  return (
    <TuneStrip
      title="Better jobs for you: tune your search"
      pct={pct}
      because={known.length > 0 ? `Matching on ${known.slice(0, 3).join(', ')}.${missing.length > 0 ? ` ${missing.length === 1 ? 'One answer' : 'A couple of answers'} would sharpen it.` : ''}` : 'Tell us a few things and your jobs get sharper.'}
      asks={missing.slice(0, 2).map((s) => ({ ask: `${s.label}.`, gain: `${cap(s.effect)}.` }))}
      actionLabel={missing.length > 0 ? 'Improve my matches' : 'See what we use'}
      actionHref="/dashboard/improve"
      tunedNote="Everything we use is set."
    />
  )
}
