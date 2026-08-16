import type { Metadata } from 'next'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { BountyClaimForm } from '@/components/dashboard/BountyClaimForm'
import { LockedFeatureNotice } from '@/components/dashboard/LockedFeatureNotice'
import { Card, CardContent } from '@/components/ui/card'
import { isDossierUnlocked } from '@/lib/scoring/dossier-unlock'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'

export const metadata: Metadata = { title: 'Got An Offer' }


const STATUS_COPY: Record<string, { heading: string; body: string }> = {
  PENDING: {
    heading: 'Your claim is being reviewed',
    body: "I've got your offer letter and details — I'll follow up once it's reviewed, usually within a few days.",
  },
  APPROVED: {
    heading: "You're approved! 🎉",
    body: "Congratulations again — your $500 Offer Bonus is approved. We'll send payment to the method you provided.",
  },
  REJECTED: {
    heading: 'Your claim needs another look',
    body: 'This claim was not approved as submitted. Reach out to support if you think this is a mistake.',
  },
}

export default async function GotHiredPage() {
  const profile = await getDashboardData()
  const [latestClaim, dossierStatus] = await Promise.all([
    prisma.bountyClaim.findFirst({
      where: { candidateId: profile.id },
      orderBy: { createdAt: 'desc' },
    }),
    isDossierUnlocked(profile.id),
  ])

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Got An Offer? 🎉</h1>
        <p className="mt-1 text-muted-foreground">
          Landed a job through NextChapter? Tell us about it and claim your $500 Offer Bonus —
          we verify offer letters before paying out.
        </p>
        <PageHeaderBoxes pageKey="got-hired" candidateId={profile.id} />
      </div>

      {latestClaim && latestClaim.status !== 'REJECTED' ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-lg font-semibold text-foreground">{STATUS_COPY[latestClaim.status].heading}</p>
            <p className="mt-2 text-sm text-muted-foreground">{STATUS_COPY[latestClaim.status].body}</p>
            <p className="mt-4 text-sm text-foreground">
              <span className="font-medium">{latestClaim.roleTitle}</span> at{' '}
              <span className="font-medium">{latestClaim.companyName}</span>
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {latestClaim?.status === 'REJECTED' && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-foreground">
              <p className="font-medium">{STATUS_COPY.REJECTED.heading}</p>
              {latestClaim.rejectionReason && <p className="mt-1 text-muted-foreground">{latestClaim.rejectionReason}</p>}
              <p className="mt-2 text-muted-foreground">You can submit a new claim below.</p>
            </div>
          )}
          {dossierStatus.unlocked ? (
            <Card>
              <CardContent className="pt-6">
                <BountyClaimForm />
              </CardContent>
            </Card>
          ) : (
            <LockedFeatureNotice
              title="Offer Bonus"
              requirement="Requires an unlocked Dossier to submit — real references, evidence, and effort on file. This is checked at the moment you submit, not sustained over time."
              status={dossierStatus.reason}
            />
          )}
        </>
      )}
    </div>
  )
}
