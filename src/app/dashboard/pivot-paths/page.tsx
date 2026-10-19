import { after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { PathwayExplorer } from '@/components/dashboard/pathway/PathwayExplorer'
import { LearningPathsCard } from '@/components/dashboard/pathway/LearningPathsCard'
import { getLearningPaths } from '@/lib/journey/learning-paths-data'
import { PIVOT_REASONS, ownedFunctionsFrom } from '@/lib/journey/pathway'
import { activeTargets, pivotInterestsOf, pivotOf } from '@/lib/journey/pivot'
import { pivotIdeas } from '@/lib/journey/pivot-ideas'
import { PivotRadar } from '@/components/dashboard/pathway/PivotRadar'
import { PivotIdeas } from '@/components/dashboard/pathway/PivotIdeas'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { Compass, TriangleAlert } from 'lucide-react'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { loadPivotPaths } from '@/lib/pivots/load'
import { EmptyState } from '@/components/ui/empty-state'
import { Spinner } from '@/components/ui/spinner'
import { PivotPathsList } from '@/components/dashboard/pivots/PivotPathsList'
import { PeopleEnergyQuestion } from '@/components/dashboard/pivots/PeopleEnergyQuestion'
import { WorkStylePrompt } from '@/components/dashboard/WorkStylePrompt'
import { readSearchExpansion } from '@/lib/profile/search-expansion'
import { readLikes } from '@/lib/profile/work-profile'
import { LikesCard } from '@/components/dashboard/LikesCard'
import { WorkAlikeCard } from '@/components/dashboard/WorkAlikeCard'
import { DEFAULT_WAGE_FLOOR, describePivot, WAGE_FLOOR_RATIO, type PivotOption, type WageFloor } from '@/lib/careers/pivots'
import { loadPivotDepth, optionsForLabels, similarRoles, type PivotDepth, type PivotDepthResult } from '@/lib/careers/pivot-depth'
import { searchOccupationTitles } from '@/lib/careers/candidate-occupation'
import { getCoreTasks } from '@/lib/careers/occupation-tasks'
import { describePay } from '@/lib/careers/local-pay'
import { isAdzunaInsightsEnabled, resolveState } from '@/lib/market/adzuna-insights'
import { PivotOptionCard } from '@/components/dashboard/pivot/PivotOptionCard'
import { PivotRoleDetail } from '@/components/dashboard/pivot/PivotRoleDetail'
import { OccupationChooser } from '@/components/dashboard/pivot/OccupationChooser'
import { WageFloorButtons } from '@/components/dashboard/pivot/WageFloorButtons'
import { PivotViewTracker } from '@/components/dashboard/pivot/PivotViewTracker'
import { RoleLookup } from '@/components/dashboard/pivot/RoleLookup'
import { ClearCareerChoicesForm } from '@/components/dashboard/pivot/ClearCareerChoicesForm'
import { OnetAttribution } from '@/components/OnetAttribution'
import { AdzunaAttribution } from '@/components/market/AdzunaAttribution'

export const metadata: Metadata = { title: 'Pivot paths' }

type Params = Record<string, string | string[] | undefined>
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''

export default async function PivotPathsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams
  const profile = await getDashboardProfile()
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Pivot paths</h1>
        <p className="text-muted-foreground">
          Where your skills carry over, ranked by how well you fit, how many of these jobs are open near you and nationally, and what they pay.
        </p>
        <p className="text-sm text-muted-foreground">
          <Link href="/dashboard/my-career" className="text-primary underline underline-offset-4">
            See these on your career timeline
          </Link>
        </p>
      </div>
      <WhatItTakes profile={profile} target={first(params.target)} why={first(params.why)} />
      <Suspense
        fallback={
          <div className="flex items-center gap-2 rounded-lg border border-border p-6 text-sm text-muted-foreground">
            <Spinner size={16} />
            Matching your skills to the job market…
          </div>
        }
      >
        <PivotPathsBody profile={profile} params={params} />
      </Suspense>
    </div>
  )
}

// "What would it take?" and the member's learning paths. Works without the O*NET data.
async function WhatItTakes({ profile, target, why }: { profile: Awaited<ReturnType<typeof getDashboardProfile>>; target: string; why: string }) {
  const [tr, learning] = await Promise.all([
    prisma.trackRecordResponse.findUnique({ where: { candidateId: profile.id }, select: { functionsOwnedOutsideCore: true, sectorHistory: true } }),
    getLearningPaths(profile.id),
  ])
  const reason = PIVOT_REASONS.find((r) => r.key === why)?.key ?? null
  const saved = activeTargets(pivotOf(profile.journeyDetails)).some((t) => t.function === target)
  if (target) {
    after(() => captureServerEvent(profile.id, 'pivot_pathway_viewed', { from: profile.primaryFunction, to: target, why: reason }))
  }
  const pivot = pivotOf(profile.journeyDetails)
  const interests = pivotInterestsOf(profile.journeyDetails)
  const ideas = pivotIdeas({
    from: profile.primaryFunction,
    keywords: [...profile.resumeKeywords, ...profile.confirmedSkillsHave],
    ownedFunctions: ownedFunctionsFrom(tr?.functionsOwnedOutsideCore),
    seniorLevel: (profile.levelRankScore ?? 0) >= 60,
    currentIndustry: profile.industryContext,
    sectorHistory: tr?.sectorHistory ?? [],
    reason,
    onRadar: (pivot?.targets ?? []).map((t) => t.function),
    industriesOnRadar: interests.industries.map((i) => i.name),
    skillsToBuild: profile.skillsToBuild,
  })
  return (
    <div className="space-y-6">
      <PivotRadar pivot={pivot} interests={interests} />
      <PivotIdeas ideas={ideas} from={profile.primaryFunction} />
      <PathwayExplorer
        from={profile.primaryFunction}
        keywords={[...profile.resumeKeywords, ...profile.confirmedSkillsHave]}
        seniorLevel={(profile.levelRankScore ?? 0) >= 60}
        ownedFunctions={ownedFunctionsFrom(tr?.functionsOwnedOutsideCore)}
        target={target || null}
        why={reason}
        alreadySaved={saved}
        currentIndustry={profile.industryContext}
        targetIndustries={profile.targetIndustries}
        sectorHistory={tr?.sectorHistory ?? []}
      />
      <LearningPathsCard paths={learning.paths} progress={learning.progress} />
    </div>
  )
}

async function PivotPathsBody({ profile, params }: { profile: Awaited<ReturnType<typeof getDashboardProfile>>; params: Params }) {
  const wageFloor: WageFloor = (Object.hasOwn(WAGE_FLOOR_RATIO, first(params.floor)) ? first(params.floor) : DEFAULT_WAGE_FLOOR) as WageFloor
  const query = first(params.q).trim().slice(0, 100)

  // "Not right? Change it" for the occupation the skills comparison starts from.
  if (first(params.change) === '1') {
    const candidates = query ? await searchOccupationTitles(query) : []
    return (
      <OccupationChooser
        heading="Change your current occupation"
        intro="Search for the job title closest to what you do now, then pick it from the list. We use it to compare skills and pay."
        candidates={candidates}
        query={query}
      />
    )
  }

  // The skills and local-pay layer loads alongside the market-ranked list and never blocks it.
  const depthLoad = loadPivotDepth(profile, wageFloor).catch((error): null => {
    console.error('Pivot paths: skills layer unavailable', error)
    return null
  })

  let result: Awaited<ReturnType<typeof loadPivotPaths>>
  try {
    result = await loadPivotPaths(profile)
  } catch (error) {
    console.error('Pivot paths: load failed', error)
    return (
      <EmptyState
        icon={TriangleAlert}
        title="We couldn't load your pivot paths"
        description="Something went wrong reading the job market. Refresh the page in a minute; if it keeps happening, tell us from the Help page."
      />
    )
  }

  const depthResult = await depthLoad
  const layer = await buildSkillsLayer({ profile, result, depthResult, wageFloor, lookup: first(params.lookup).trim().slice(0, 100), role: first(params.role) })

  if (!result.source) {
    return (
      <div className="space-y-6">
      <EmptyState
        icon={Compass}
        title="Tell us what you do now"
        description="Pivot paths start from your current role. Add your most recent job title or your main function in Search Strategy, and we'll map where your skills carry over."
        cta={{ label: 'Open Search Strategy', href: '/dashboard/search-strategy' }}
      />
      {layer.sections}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {result.contraction.contracting && (
        <div className="space-y-1 rounded-lg border border-warning/40 bg-warning/5 p-4" role="note">
          <p className="text-sm font-semibold text-foreground">{result.contraction.headline}</p>
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
            {result.contraction.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        Starting from: <span className="font-medium text-foreground">{result.source.label}</span>
        {profile.highestLevelReached && <> at {profile.highestLevelReached.toLowerCase()} level</>}.{' '}
        <Link href="/dashboard/search-strategy" className="text-primary underline underline-offset-4">
          Not right? Update it
        </Link>{' '}
        ·{' '}
        <Link href="/dashboard/market" className="text-primary underline underline-offset-4">
          See your job market
        </Link>
      </p>

      <PeopleEnergyQuestion current={result.energy} source={result.energySource} />

      <LikesCard initial={readLikes(profile.workStyleAnswers)} />

      <Suspense fallback={null}>
        <WorkAlikeCard candidateId={profile.id} />
      </Suspense>

      <WorkStylePrompt candidateId={profile.id} limit={4} />

      <PivotPathsList
        suggestions={result.suggestions}
        more={result.more}
        inSearch={readSearchExpansion(profile.searchExpansion).roles}
        hidden={result.hidden}
        sourceFunction={profile.primaryFunction}
        sourceRole={result.source.key}
        contracting={result.contraction.contracting}
        marketReady={result.marketReady}
        surface="pivot_paths_page"
        details={layer.details}
      />

      {layer.sections}

      <p className="text-xs text-muted-foreground">
        Job counts come from the live NextChapter job board at a level you could realistically land, refreshed nightly. Trends compare each
        role&apos;s share of new postings with the period before, and appear once there is enough history. Pay is the typical posted salary
        where enough jobs list one. Layoff notices are state WARN filings across all employers. Long-term outlook and median wages are national BLS figures (Employment Projections and OEWS) via CareerOneStop, refreshed yearly. What O*NET lists for each kind of work, and paths marked as related by O*NET, come from O*NET Web Services, refreshed yearly.
      </p>
    </div>
  )
}

type SkillsLayer = { details: Record<string, { socCode: string; node: React.ReactNode }>; sections: React.ReactNode }

// Everything O*NET and BLS add to the market-ranked list: a "what it takes" section on each path,
// the roles that use similar skills but aren't on the curated map, and a lookup for any role. Empty
// when the occupation data isn't loaded yet, so the page above works exactly as it did without it.
async function buildSkillsLayer({
  profile,
  result,
  depthResult,
  wageFloor,
  lookup,
  role,
}: {
  profile: Awaited<ReturnType<typeof getDashboardProfile>>
  result: Awaited<ReturnType<typeof loadPivotPaths>>
  depthResult: PivotDepthResult | null
  wageFloor: WageFloor
  lookup: string
  role: string
}): Promise<SkillsLayer> {
  // What we keep about their direction, with a way to remove it. Only a confirmed occupation is stored.
  const clearControl = (occupationSaved: boolean) =>
    occupationSaved || profile.targetRoleType ? (
      <section className="rounded-lg border border-border p-4" aria-label="Your saved choices">
        <ClearCareerChoicesForm occupationSaved={occupationSaved} targetRole={profile.targetRoleType} />
      </section>
    ) : null
  const none: SkillsLayer = { details: {}, sections: clearControl(false) }
  if (!depthResult) return none

  if (depthResult.status === 'needs_choice') {
    return {
      details: {},
      sections: (
        <>
        <section className="space-y-2 rounded-lg border border-border p-4" aria-labelledby="pivot-pick-occupation">
          <h2 id="pivot-pick-occupation" className="text-base font-semibold text-foreground">
            See what each role takes
          </h2>
          <p className="text-sm text-muted-foreground">
            Pick the occupation closest to your latest job and we will show the skills each role asks for, pay near you and matching training.
          </p>
          <Link href="/dashboard/pivot-paths?change=1" className="text-sm font-medium text-primary underline underline-offset-4">
            Choose my occupation
          </Link>
        </section>
        {clearControl(false)}
        </>
      ),
    }
  }
  if (depthResult.status !== 'ready') return none

  const depth: PivotDepth = depthResult.depth
  const state = resolveState(profile.currentState)
  const stateLabel = profile.currentState ?? 'near you'

  // The curated options and the role-lookup search are independent reads.
  const [curated, candidates] = await Promise.all([
    optionsForLabels(
      depth,
      [...result.suggestions, ...result.more].map((s) => ({ key: s.target, label: s.label }))
    ).catch(() => new Map<string, PivotOption>()),
    lookup ? searchOccupationTitles(lookup) : Promise.resolve([]),
  ])
  const shown = new Set([...curated.values()].map((o) => o.socCode))
  const similar = similarRoles(depth, shown)
  const looked = role ? describePivot(depth.input, role) : null
  const tasksBySoc = await getCoreTasks([...new Set([...curated.values(), ...similar, ...(looked ? [looked] : [])].map((o) => o.socCode))])

  const details: SkillsLayer['details'] = {}
  for (const [target, option] of curated) {
    details[target] = {
      socCode: option.socCode,
      node: (
        <PivotRoleDetail
          option={option}
          state={state}
          stateLabel={stateLabel}
          stateCode={depth.stateCode}
          tasks={tasksBySoc.get(option.socCode) ?? []}
          currentTarget={profile.targetRoleType}
          showLocalOpenings={false}
        />
      ),
    }
  }

  const card = (option: PivotOption, rank: number) => (
    <PivotOptionCard
      key={option.socCode}
      fromSoc={depth.sourceSoc}
      rank={rank}
      currentTarget={profile.targetRoleType}
      option={option}
      state={state}
      stateLabel={stateLabel}
      stateCode={depth.stateCode}
      tasks={tasksBySoc.get(option.socCode) ?? []}
    />
  )

  return {
    details,
    sections: (
      <>
        <PivotViewTracker sourceSoc={depth.sourceSoc} optionCount={similar.length} wageFloor={wageFloor} source={depth.source} />

        <section id="similar-skills" className="scroll-mt-20 space-y-3" aria-labelledby="similar-skills-heading">
          <div className="space-y-1">
            <h2 id="similar-skills-heading" className="text-lg font-semibold tracking-tight">
              More roles that use similar skills
            </h2>
            <p className="text-sm text-muted-foreground">
              Closest match first, from what each occupation asks for in O*NET, the US Department of Labor&apos;s occupation database, with pay and growth from the Bureau of
              Labor Statistics. These describe occupations in general, not a prediction for you.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Compared with: <span className="font-medium text-foreground">{depth.sourceTitle}</span>{' '}
            <Link href="/dashboard/pivot-paths?change=1" className="text-primary underline underline-offset-4">
              Not right? Change it
            </Link>
            {depth.source === 'FUNCTION_PROXY' && '. We chose this from the function on your profile because we could not read a job title. Confirm or change it so the matches fit.'}
          </p>
          {depth.sourcePay && (
            <p className="text-sm text-muted-foreground">
              Median pay in your current field{depth.sourcePay.areaName ? ` (${depth.sourcePay.level === 'NATIONAL' ? 'nationwide' : depth.sourcePay.areaName})` : ''}:{' '}
              {describePay(depth.sourcePay)}.
              {depth.localLabel && depth.sourcePay.level === 'NATIONAL' ? ` We do not have pay for ${depth.localLabel} yet, so pay is shown nationwide.` : ''}
            </p>
          )}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">How much pay are you willing to give up?</p>
            <WageFloorButtons current={wageFloor} socCode={depth.sourceSoc} />
          </div>
          {similar.length === 0 ? (
            <EmptyState
              icon={Compass}
              title="No more roles match at this pay level"
              description="Nothing else close to your field clears the pay level you picked. Choose “Any pay” above to see the closest matches."
            />
          ) : (
            <div className="space-y-4">{similar.map((o, i) => card(o, i + 1))}</div>
          )}
        </section>

        <section id="look-up-a-role" className="scroll-mt-20 space-y-3" aria-labelledby="look-up-heading">
          <div className="space-y-1">
            <h2 id="look-up-heading" className="text-lg font-semibold tracking-tight">
              Look up any role
            </h2>
            <p className="text-sm text-muted-foreground">Have a role in mind that isn&apos;t listed? Search for it to see how it compares with your current work.</p>
          </div>
          <RoleLookup query={lookup} candidates={candidates} />
          {role && !looked && <p className="text-sm text-muted-foreground">We could not compare that role with yours. Search again and pick one from the list.</p>}
          {looked && card(looked, 1)}
        </section>

        {clearControl(depth.source === 'CANDIDATE_CONFIRMED')}

        {isAdzunaInsightsEnabled() && <AdzunaAttribution surface="pivot_tool" />}
        <OnetAttribution />
      </>
    ),
  }
}
