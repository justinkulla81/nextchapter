import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCandidateProfileForUser } from '@/lib/onboarding/get-profile'
import { getScoreRevealData } from '@/lib/onboarding/score-reveal'
import { Button } from '@/components/ui/button'
import { ScoreRevealSection } from '@/components/onboarding/ScoreRevealSection'

export default async function ScorePage() {
  const profile = await getCandidateProfileForUser()

  if (!profile.assessmentComplete) {
    redirect('/onboarding')
  }

  if (profile.registrationCompletedAt) {
    redirect('/dashboard')
  }

  const { grade, proofOfWork } = await getScoreRevealData(profile.id)

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        {profile.firstName ? `Nice work, ${profile.firstName}!` : 'Your Current Market Reality'}
      </h1>

      <Button nativeButton={false} render={<Link href="/onboarding/create-account" />}>
        Create your account to get your full report and action plan
      </Button>

      <ScoreRevealSection initialGrade={grade} initialProofOfWork={proofOfWork} />

      {/* Repeats the top CTA — the grade legend above makes this a long
          scroll, and a candidate who reads all the way through shouldn't
          have to scroll back up to act on it. */}
      <Button nativeButton={false} render={<Link href="/onboarding/create-account" />}>
        Create your account to get your full report and action plan
      </Button>
    </div>
  )
}
