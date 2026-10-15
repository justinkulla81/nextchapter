import type { Metadata } from 'next'
import Link from 'next/link'
import { Compass } from 'lucide-react'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { getTaxonomy } from '@/lib/careers/taxonomy'
import { resolveCandidateOccupation, searchOccupationTitles } from '@/lib/careers/candidate-occupation'
import { DEFAULT_WAGE_FLOOR, nationalPayFromProfile, rankPivots, WAGE_FLOOR_RATIO, type WageFloor } from '@/lib/careers/pivots'
import { resolveArea } from '@/lib/careers/area'
import { getCoreTasks } from '@/lib/careers/occupation-tasks'
import { skillIdsFromKeywords } from '@/lib/careers/alias-server'
import { getAreaCatalog, getPayLookup } from '@/lib/careers/local-pay-server'
import { bestPay, describePay, type PayByLevel } from '@/lib/careers/local-pay'
import { resolveState, isAdzunaInsightsEnabled } from '@/lib/market/adzuna-insights'
import { toStateCode } from '@/lib/careers/state'
import { EmptyState } from '@/components/ui/empty-state'
import { PivotOptionCard } from '@/components/dashboard/pivot/PivotOptionCard'
import { OccupationChooser } from '@/components/dashboard/pivot/OccupationChooser'
import { WageFloorButtons } from '@/components/dashboard/pivot/WageFloorButtons'
import { PivotViewTracker } from '@/components/dashboard/pivot/PivotViewTracker'
import { OnetAttribution } from '@/components/OnetAttribution'
import { AdzunaAttribution } from '@/components/market/AdzunaAttribution'

export const metadata: Metadata = { title: 'Explore other roles' }

type Params = Record<string, string | string[] | undefined>
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''

export default async function PivotPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams
  const profile = await getDashboardProfile()
  const wageFloor: WageFloor = (first(params.floor) in WAGE_FLOOR_RATIO ? first(params.floor) : DEFAULT_WAGE_FLOOR) as WageFloor
  const query = first(params.q).trim().slice(0, 100)
  const changing = first(params.change) === '1'

  const header = (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold tracking-tight">Explore other roles</h1>
      <p className="text-muted-foreground">
        Roles that ask for much the same skills as your current field, closest match first, with pay and growth beside each one. Skill
        requirements come from O*NET, the US Department of Labor&apos;s occupation database, and pay and growth from the Bureau of Labor
        Statistics. These describe occupations in general, not a prediction for you.
      </p>
      <p className="text-sm text-muted-foreground">
        Want to see where jobs are actually opening near you? Try{' '}
        <Link href="/dashboard/pivot-paths" className="text-primary underline-offset-4 hover:underline">
          Pivot paths
        </Link>
        .
      </p>
    </div>
  )

  const resolution = await resolveCandidateOccupation(profile.id)

  if (resolution.status === 'unavailable') {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState
          icon={Compass}
          title="Occupation data isn't loaded yet"
          description="We are still setting up the occupation data behind this page. Check back soon."
        />
      </div>
    )
  }

  if (resolution.status === 'no_title') {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState
          icon={Compass}
          title="We need your latest job title"
          description="Upload your resume and we will read your most recent role, then show where your skills point next."
          cta={{ label: 'Upload your resume', href: '/dashboard/resume' }}
        />
      </div>
    )
  }

  if (resolution.status === 'needs_choice' || changing) {
    const candidates = query
      ? await searchOccupationTitles(query)
      : resolution.status === 'needs_choice'
        ? resolution.candidates
        : []
    return (
      <div className="space-y-6">
        {header}
        <OccupationChooser
          heading={resolution.status === 'needs_choice' ? 'Which of these is closest to your job?' : 'Change your current occupation'}
          intro={
            resolution.status === 'needs_choice' && resolution.matchedFrom
              ? `We could not match “${resolution.matchedFrom}” to a single occupation. Pick the closest one, or search for another title.`
              : 'Search for the job title closest to what you do now, then pick it from the list.'
          }
          matchedFrom={resolution.status === 'needs_choice' ? resolution.matchedFrom : ''}
          candidates={candidates}
          query={query}
        />
      </div>
    )
  }

  const taxonomy = (await getTaxonomy())!
  // Pay is compared place to place: their metro area if we hold it, else their state, else the nation.
  const area = resolveArea({ city: profile.currentCity, state: profile.currentState }, await getAreaCatalog())
  const lookup = await getPayLookup(area)
  const payOf = (soc: string): PayByLevel => {
    const local = lookup(soc)
    return Object.keys(local).length > 0 ? local : nationalPayFromProfile(taxonomy.profiles.get(soc))
  }
  const haveKeywords = [...profile.resumeKeywords, ...profile.confirmedSkillsHave]
  const options = rankPivots({
    space: taxonomy.space,
    profiles: taxonomy.profiles,
    sourceSoc: resolution.socCode,
    wageFloor,
    resumeKeywords: haveKeywords,
    haveSkillIds: await skillIdsFromKeywords(haveKeywords),
    pay: payOf,
  })
  const source = taxonomy.profiles.get(resolution.socCode)!
  const tasksBySoc = await getCoreTasks(options.map((o) => o.socCode))
  const sourcePay = bestPay(payOf(resolution.socCode))
  const state = resolveState(profile.currentState)
  const localLabel = area.metro?.name ?? area.state?.name ?? null

  return (
    <div className="space-y-6">
      {header}
      <PivotViewTracker sourceSoc={resolution.socCode} optionCount={options.length} wageFloor={wageFloor} source={resolution.source} />

      <section className="space-y-3" aria-labelledby="pivot-start">
        <h2 id="pivot-start" className="text-sm font-medium text-foreground">
          Starting from: {source.title}{' '}
          <Link href="/dashboard/pivot?change=1" className="font-normal text-primary underline-offset-4 hover:underline">
            Not right? Change it
          </Link>
        </h2>
        {resolution.source === 'FUNCTION_PROXY' && (
          <p className="text-sm text-muted-foreground">
            We chose this from the function on your profile because we could not read a job title. Confirm or change it so the matches fit.
          </p>
        )}
        {sourcePay && (
          <p className="text-sm text-muted-foreground">
            Median pay in your current field{sourcePay.areaName ? ` (${sourcePay.level === 'NATIONAL' ? 'nationwide' : sourcePay.areaName})` : ''}: {describePay(sourcePay)}.
            {localLabel && sourcePay.level === 'NATIONAL' ? ` We do not have pay for ${localLabel} yet, so pay is shown nationwide.` : ''}
          </p>
        )}
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">How much pay are you willing to give up?</p>
          <WageFloorButtons current={wageFloor} socCode={resolution.socCode} />
        </div>
      </section>

      {options.length === 0 ? (
        <EmptyState
          icon={Compass}
          title="No roles match at this pay level"
          description="Nothing close to your field clears the pay level you picked. Choose “Any pay” above to see the closest matches."
        />
      ) : (
        <div className="space-y-4">
          {options.map((option, i) => (
            <PivotOptionCard key={option.socCode} fromSoc={resolution.socCode} rank={i + 1} option={option} state={state} stateLabel={profile.currentState ?? 'near you'} stateCode={toStateCode(profile.currentState)} tasks={tasksBySoc.get(option.socCode) ?? []} />
          ))}
        </div>
      )}

      {isAdzunaInsightsEnabled() && <AdzunaAttribution surface="pivot_tool" />}
      <OnetAttribution />
    </div>
  )
}
