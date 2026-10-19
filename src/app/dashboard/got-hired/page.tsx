import type { Metadata } from 'next'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { BountyClaimForm } from '@/components/dashboard/BountyClaimForm'
import { LockedFeatureNotice } from '@/components/dashboard/LockedFeatureNotice'
import { Card, CardContent } from '@/components/ui/card'
import { isDossierUnlocked } from '@/lib/scoring/dossier-unlock'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'
import { EmployerOutcomeSharingCard } from '@/components/dashboard/EmployerOutcomeSharingCard'
import { isRedesignOn } from '@/lib/redesign/flag'
import { PageHeader } from '@/components/candidate/PageHeader'
import { ShowMore } from '@/components/candidate/ShowMore'
import { ActionLink } from '@/components/candidate/ActionLink'
import { AgeBandForm, HireOutcomeForm, LastJobEndedForm } from '@/components/dashboard/HireOutcomeForm'

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
  const profile = await getDashboardProfile()
  const [latestClaim, dossierStatus, seats] = await Promise.all([
    prisma.bountyClaim.findFirst({
      where: { candidateId: profile.id },
      orderBy: { createdAt: 'desc' },
    }),
    isDossierUnlocked(profile.id),
    prisma.outplacementSeat.findMany({
      where: { candidateId: profile.id, status: 'ACTIVATED' },
      select: { id: true, shareOutcomeWithEmployer: true, contract: { select: { org: { select: { name: true, programBrandName: true } } } } },
    }),
  ])

  const block0 = (
    <>
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Got An Offer? 🎉</h1>
        <p className="mt-1 text-muted-foreground">
          Landed a job through NextChapter? Tell us about it and claim your $500 Offer Bonus —
          we verify offer letters before paying out.
        </p>
        <PageHeaderBoxes pageKey="got-hired" candidateId={profile.id} />
      </div>
    </>
  )

  const block1 = (
    <>
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Where you are in your search</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Add your last day worked so we compare you with people at the same stage, not with everyone.
            </p>
          </div>
          <LastJobEndedForm current={profile.lastJobEndedAt ? profile.lastJobEndedAt.toISOString().slice(0, 10) : null} />
          <AgeBandForm current={profile.ageBand} />
        </CardContent>
      </Card>
    </>
  )

  const block2 = (
    <>
      <EmployerOutcomeSharingCard
        seats={seats.map((st) => ({ seatId: st.id, orgName: st.contract.org.programBrandName ?? st.contract.org.name, share: st.shareOutcomeWithEmployer }))}
      />
    </>
  )

  const block3 = (
    <>
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Tell us how it came together</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Full-time, interim, fractional or advisory work all count. This is separate from the Offer Bonus below and needs no
              offer letter.
            </p>
          </div>
          <HireOutcomeForm />
        </CardContent>
      </Card>
    </>
  )

  const block4 = (
    <>
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
              requirement="Requires an unlocked Dossier to submit — real outreach, applications, search effort and an assessment on file. This is checked at the moment you submit, not sustained over time."
              status={dossierStatus.reason}
            />
          )}
        </>
      )}
    </>
  )

  if (isRedesignOn(profile.email)) {
    const canClaim = !latestClaim || latestClaim.status === 'REJECTED'
    return (
      <div className="space-y-8">
        <PageHeader
          title="Offers"
          intro="Landed a job through NextChapter? Tell us how it came together. Full-time, interim, fractional and advisory work all count, and each helps the next person."
          action={
            canClaim ? (
              <ActionLink href="#claim" kind="primary" event="offer_claim_started" props={{ dossierUnlocked: dossierStatus.unlocked, previouslyRejected: latestClaim?.status === 'REJECTED' }}>
                Claim your $500 Offer Bonus
              </ActionLink>
            ) : undefined
          }
        />
        {block3}
        <div id="claim" className="scroll-mt-4">
          {block4}
        </div>
        <ShowMore page="offers" label="Show where you are in your search">
          {block1}
          {block2}
        </ShowMore>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {block0}
      {block1}
      {block2}
      {block3}
      {block4}
    </div>
  )
}
