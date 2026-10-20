import type { Metadata } from 'next'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { BountyClaimForm } from '@/components/dashboard/BountyClaimForm'
import { LockedFeatureNotice } from '@/components/dashboard/LockedFeatureNotice'
import { isDossierUnlocked } from '@/lib/scoring/dossier-unlock'
import { EmployerOutcomeSharingCard } from '@/components/dashboard/EmployerOutcomeSharingCard'
import { PageHeader } from '@/components/candidate/PageHeader'
import { ShowMore } from '@/components/candidate/ShowMore'
import { ActionLink } from '@/components/candidate/ActionLink'
import { PlainNote, SectionBlock } from '@/components/candidate/Blocks'
import { offerClaimStatusText } from '@/lib/redesign/jobs-pages'
import { AgeBandForm, HireOutcomeForm, LastJobEndedForm } from '@/components/dashboard/HireOutcomeForm'

export const metadata: Metadata = { title: 'Got An Offer' }


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

  const canClaim = !latestClaim || latestClaim.status === 'REJECTED'
  const claimStatus = latestClaim && latestClaim.status !== 'REJECTED' ? offerClaimStatusText(latestClaim.status) : null
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
      <SectionBlock id="how-h" title="Tell us how it came together" why="This helps us show what works for people at your stage. It is separate from the Offer Bonus and needs no offer letter.">
        <HireOutcomeForm />
      </SectionBlock>
      <div id="claim" className="scroll-mt-4">
        {claimStatus && latestClaim ? (
          <SectionBlock id="claim-h" title={claimStatus.heading} why={claimStatus.body}>
            <PlainNote>
              <span className="font-semibold">{latestClaim.roleTitle}</span> at <span className="font-semibold">{latestClaim.companyName}</span>
            </PlainNote>
          </SectionBlock>
        ) : (
          <SectionBlock
            id="claim-h"
            title="Claim your $500 Offer Bonus"
            why={latestClaim?.status === 'REJECTED' ? `${offerClaimStatusText('REJECTED').body}${latestClaim.rejectionReason ? ` Reason given: ${latestClaim.rejectionReason}` : ''} You can submit a new claim below.` : 'We check the offer letter before we pay.'}
          >
            {dossierStatus.unlocked ? (
              <BountyClaimForm />
            ) : (
              <LockedFeatureNotice
                redesign
                title="The Offer Bonus"
                requirement="It needs an unlocked Dossier: real outreach, applications, search effort and an assessment on file. This is checked when you submit."
                status={dossierStatus.reason}
              />
            )}
          </SectionBlock>
        )}
      </div>
      <ShowMore page="offers" label="Show where you are in your search">
        <SectionBlock id="stage-h" title="Where you are in your search" why="Add your last day worked so we compare you with people at the same stage, not with everyone.">
          <LastJobEndedForm current={profile.lastJobEndedAt ? profile.lastJobEndedAt.toISOString().slice(0, 10) : null} />
          <AgeBandForm current={profile.ageBand} />
        </SectionBlock>
        <EmployerOutcomeSharingCard
          seats={seats.map((st) => ({ seatId: st.id, orgName: st.contract.org.programBrandName ?? st.contract.org.name, share: st.shareOutcomeWithEmployer }))}
        />
      </ShowMore>
    </div>
  )
}
