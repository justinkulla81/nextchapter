import type { Metadata } from 'next'
import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { BenefitsPrioritiesForm } from '@/components/dashboard/BenefitsPrioritiesForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { estimateActionEffort } from '@/lib/weekly/action-effort'

export const metadata: Metadata = { title: 'Search Goals' }

const BENEFITS_POINTS = estimateActionEffort({ actionType: 'BENEFITS_PRIORITIES_CONFIRMED' }).points

// One of three sub-pages under the My Profile hub (see
// /dashboard/profile/page.tsx). Comp and benefits only — the broader
// "optional search questions" (jobs applied, networking level, etc.) live
// on My Search Strategy instead.
export default async function SearchGoalsPage() {
  const profile = await getDashboardData()
  const benefitsAnswered = !!profile.benefitsPrioritiesBonusAt

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <Link href="/dashboard/profile" className="text-sm text-muted-foreground hover:text-foreground">
          ← My Profile
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Search Goals</h1>
        <p className="mt-1 text-muted-foreground">
          What matters to you beyond salary — helps your coach and recruiter contacts steer you
          toward roles and offers that actually fit.
        </p>
      </div>

      <Card id="comp-benefits" className="scroll-mt-4">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Compensation &amp; benefits
            </CardTitle>
            {!benefitsAnswered && (
              <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                +{BENEFITS_POINTS} pts
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {benefitsAnswered ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="text-success" aria-hidden>
                ✓
              </span>
              Answered
            </p>
          ) : (
            <BenefitsPrioritiesForm targetCompMin={profile.targetCompMin} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
