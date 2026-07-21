import { redirect } from 'next/navigation'
import { getCandidateProfileForUser } from '@/lib/onboarding/get-profile'
import { prisma } from '@/lib/prisma'
import { CoachConsentChoice } from '@/components/onboarding/CoachConsentChoice'

export default async function CoachConsentPage() {
  const profile = await getCandidateProfileForUser()
  if (!profile.coachId) redirect('/onboarding')

  const coach = await prisma.coach.findUnique({ where: { id: profile.coachId }, select: { fullName: true } })
  const coachName = coach?.fullName ?? 'your coach'

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="max-w-md space-y-3 text-left">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Share with {coachName}?</h1>
        <p className="text-muted-foreground">
          You joined NextChapter through {coachName}&apos;s invite link. Being connected to a coach
          doesn&apos;t automatically share anything — this is a separate, specific choice.
        </p>
        <p className="text-muted-foreground">
          If you agree, {coachName} will be able to see your Executive Dossier and your Coaching
          Notes (a fuller picture — sentiment trends, compensation, gap analysis detail, and more —
          meant to help them coach you well). Neither document is ever downloadable, exportable, or
          shared further by them. This is separate from anything you choose to share externally
          yourself.
        </p>
      </div>
      <CoachConsentChoice coachName={coachName} />
    </div>
  )
}
