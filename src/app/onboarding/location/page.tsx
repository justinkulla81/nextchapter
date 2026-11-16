import { redirect } from 'next/navigation'
import { getCandidateProfileForUser } from '@/lib/onboarding/get-profile'
import { LocationForm } from '@/components/onboarding/LocationForm'
import { BundleShell } from '@/components/onboarding/bundles/BundleShell'
import { BundleForm } from '@/components/onboarding/bundles/BundleForm'
import { submitWhere } from '@/app/onboarding/bundle-actions'
import { effectiveJourney } from '@/lib/journey/journey'
import { flowOfProfile } from '@/lib/onboarding/flag'
import { storedAnswers } from '@/lib/onboarding/answers'
import { usableAnswers } from '@/lib/onboarding/bundles'
import { prisma } from '@/lib/prisma'
import { arrivedFromDetails } from '@/lib/onboarding/arrived-from'
import { BoardConnectOffer } from '@/components/onboarding/bundles/BoardConnectOffer'

export default async function LocationPage() {
  const profile = await getCandidateProfileForUser({ registrationSync: false })

  if (!profile.onboardingResumeConfirmedAt) {
    redirect('/onboarding/confirm')
  }
  // The short question bundles (O4), editable after answering.
  if (flowOfProfile(profile) === 'bundles') {
    const journey = effectiveJourney(profile)
    // Started from a place or board page that names one workforce board: offer it, unless they are already connected.
    const arrived = arrivedFromDetails(profile.journeyDetails)
    const board = arrived?.boardId
      ? await prisma.workforceBoard.findUnique({
          where: { id: arrived.boardId },
          select: { id: true, name: true, connections: { where: { candidateId: profile.id, status: 'ACTIVE' }, select: { id: true }, take: 1 } },
        }).catch(() => null)
      : null
    const offer = board && board.connections.length === 0 ? board : null
    const stored = usableAnswers('where', { journey }, storedAnswers(profile))
    // "I'm moving here": they already said they would move.
    const initial = arrived?.situation === 'relocating' && !stored.relocation ? { ...stored, relocation: 'yes' } : stored
    return (
      <BundleShell id="where">
        <BundleForm
          bundle="where"
          initial={initial}
          extra={offer ? <BoardConnectOffer boardId={offer.id} boardName={offer.name} /> : undefined}
          storedJourney={journey}
          payoffInput={{ storedStage: profile.journeyStage }}
          action={submitWhere}
          previewJobs="where"
        />
      </BundleShell>
    )
  }
  if (profile.onboardingLocationConfirmedAt) {
    redirect('/onboarding/contract')
  }

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="max-w-xl">
        <h1 className="text-2xl font-semibold tracking-tight">Where are you searching from?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This shapes which roles the Market Reality Assessment weighs as realistic for you.
        </p>
      </div>
      <LocationForm profile={profile} />
    </div>
  )
}
