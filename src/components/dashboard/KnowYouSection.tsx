import type { CandidateProfile } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { US_STATE_CODES } from '@/lib/pay/market-pay'
import { loadActivePreferences } from '@/lib/jobs/job-dismiss-server'
import { computeMatchState } from '@/lib/personalization/match-compute'
import { signalInputsFor } from '@/lib/personalization/know-you'
import { buildSignals, precisionOf } from '@/lib/personalization/signals'
import { smarterLines } from '@/lib/personalization/smarter'
import { KnowYouCard } from '@/components/dashboard/KnowYouCard'

/** Loads the member's match run and shows "What we know about you". Wrap in Suspense; nothing when matching has no basis. */
export async function KnowYouSection({ profile, cityFallback }: { profile: CandidateProfile; cityFallback: string }) {
  const [state, prefs, last] = await Promise.all([
    computeMatchState(profile, { live: true }).catch((error) => {
      console.error('What we know about you unavailable:', error)
      return null
    }),
    loadActivePreferences(profile.id).catch(() => []),
    prisma.memberMatchSnapshot
      .findFirst({ where: { candidateId: profile.id, kind: 'retune' }, orderBy: { createdAt: 'desc' }, select: { trigger: true, createdAt: true, relevant: true, detail: true } })
      .catch(() => null),
  ])
  if (!state) return null
  const signals = buildSignals(signalInputsFor(profile, state))
  const before = (last?.detail as { before?: { matches?: number } | null } | null)?.before?.matches ?? null
  const lines = smarterLines({
    passedOn: state.passedOn,
    hiddenLikeThem: state.hiddenLikeThem,
    hasHides: prefs.some((p) => p.action !== 'downweight'),
    toolsConfirmed: !!profile.toolsConfirmedAt,
    newThisWeekSkills: state.newThisWeekSkills,
    lastRetune: last ? { trigger: last.trigger, at: last.createdAt, before, after: last.relevant } : null,
  })
  return <KnowYouCard signals={signals} precision={precisionOf(signals)} lines={lines} states={[...US_STATE_CODES].sort()} cityFallback={cityFallback} />
}
