import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buildSearchPlanAreas } from '@/lib/dashboard/search-plan'
import { SearchPlanAreaRow } from '@/components/dashboard/SearchPlanAreaRow'
import type { WeeklyEngineKey } from '@/lib/scoring/grade'

// Post-activation "Search Plan" — Master Build Script #931/#932. Shown once
// a candidate clears the dashboard-wide hard gate (see access-gate.ts's
// getHardGateStatus === 'unlocked'; the caller decides that, not this
// component). Surfaces the same six areas the Weekly Search Sprint already
// scores (References, Skills, Networking, Applications, Interim Work,
// Posting), each with its real, already-computed count/tier — no new
// numbers invented here — plus a link to go do more in that area. This is
// deliberately NOT the pre-activation ActivationChecklistCard (narrower,
// self-hiding) and NOT WeeklyFocusCard (a free-text strategic narrative) —
// a durable, always-visible-once-unlocked hub instead.
export function SearchPlanCard(props: {
  completedReferencesCount: number
  learningBadgeCount: number
  outreachLogCount: number
  totalApplications: number
  interimSignupCount: number
  linkedInActivityCount: number
  laggingEngines: WeeklyEngineKey[]
}) {
  const areas = buildSearchPlanAreas(props)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">Your Search Plan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="px-3 pb-2 text-sm text-muted-foreground">
          Six areas move your score. Here&apos;s where you stand and what to work on next.
        </p>
        {areas.map((area) => (
          <SearchPlanAreaRow key={area.area} area={area} />
        ))}
      </CardContent>
    </Card>
  )
}
