import type { Metadata } from 'next'
import { getEqOverIqContributorDashboardData } from '@/lib/eqoveriq/contributors/get-contributor-dashboard-data'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export const metadata: Metadata = {
  title: { absolute: 'EQoverIQ — Your application' },
  robots: { index: false, follow: false },
}

export default async function EqOverIqContributorPortalPage() {
  const profile = await getEqOverIqContributorDashboardData()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Your application</h1>

      {profile.status === 'PENDING' && (
        <Card>
          <CardHeader>
            <CardTitle>Under review</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              We review every application by hand — there&apos;s no automated timeline to give you, but we&apos;ll
              email you the moment there&apos;s a decision. Thanks for your patience.
            </p>
          </CardContent>
        </Card>
      )}

      {profile.status === 'APPROVED' && (
        <Card>
          <CardHeader>
            <CardTitle>You&apos;re approved</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              You&apos;re in the contributor pool. Right now, matching real opportunities to contributors is a
              manual, hands-on process on our end — we&apos;ll reach out by email as soon as something is a real
              fit. There&apos;s nothing else to do here yet.
            </p>
          </CardContent>
        </Card>
      )}

      {profile.status === 'REJECTED' && (
        <Card>
          <CardHeader>
            <CardTitle>Not a fit right now</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              After review, we don&apos;t think this is a fit for the contributor pool right now. We appreciate you
              taking the time to apply.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
