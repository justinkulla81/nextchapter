import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { getDemandByState, getDemandCount, getSalaryHistogram, getSalaryHistory, getTopHiringCompanies, isAdzunaInsightsEnabled, memberMarketRole, resolveState } from '@/lib/market/adzuna-insights'
import { AdzunaMarketRedesign } from '@/components/market/AdzunaMarketRedesign'
import { EmptyNote } from '@/components/candidate/Blocks'
import { InlineLoadingState } from '@/components/ui/spinner'

export function AdzunaMarketSectionLoading() {
  return <InlineLoadingState label="Loading salary and demand data for your role…" className="mt-4" />
}

// "The market for your role" — Adzuna's advertised-salary distribution,
// 6-month salary trend, demand by state and top hiring companies for the
// member's target role, scoped to their state (or nationwide). Reads through
// the weekly shared cache in adzuna-insights.ts; render inside <Suspense>
// with AdzunaMarketSectionLoading as the fallback, since a cold cache calls
// Adzuna inline.
export async function AdzunaMarketSection({ candidateId, scope }: { candidateId: string; scope: 'state' | 'us' }) {
  if (!isAdzunaInsightsEnabled()) return null
  const candidate = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    select: { targetRoleType: true, targetFunction: true, primaryFunction: true, currentState: true, targetCompMin: true },
  })
  if (!candidate) return null

  const role = memberMarketRole(candidate)
  if (!role) {
    return (
      <EmptyNote>
        Add your target role on your{' '}
        <Link href="/dashboard/profile" className="font-medium text-brand underline underline-offset-4">
          profile
        </Link>{' '}
        and we show what employers are paying for it and who is hiring.
      </EmptyNote>
    )
  }

  const stateName = resolveState(candidate.currentState)
  const stateScoped = scope === 'state' && stateName !== null
  const where = stateScoped ? stateName : null
  const placeLabel = where ?? 'the US'

  let results
  try {
    results = await Promise.all([
      getSalaryHistogram({ role, state: where }, { onMiss: 'fetch' }),
      getSalaryHistory({ role, state: where }, { onMiss: 'fetch' }),
      getTopHiringCompanies({ role, state: where }, { onMiss: 'fetch' }),
      getDemandCount({ role, state: where }, { onMiss: 'fetch' }),
      getDemandByState({ role }, { onMiss: 'fetch' }),
    ])
  } catch {
    return <EmptyNote>We could not load market data for {role} just now. Reload the page in a few minutes to try again.</EmptyNote>
  }
  const [histogram, history, top, demand, geo] = results

  captureServerEvent(candidateId, 'market_data_viewed', {
    surface: 'market_reality',
    role,
    scope: stateScoped ? 'state' : 'us',
    state: stateName,
    hasHistogram: !!histogram.data,
    hasHistory: !!history.data,
    hasTopCompanies: !!top.data,
    hasDemandByState: !!geo.data,
  })

  return (
    <AdzunaMarketRedesign
      role={role}
      placeLabel={placeLabel}
      stateName={stateName}
      stateScoped={stateScoped}
      targetCompMin={candidate.targetCompMin}
      demand={demand.data}
      histogram={histogram.data}
      history={history.data}
      top={top.data}
      geo={geo.data}
    />
  )
}
