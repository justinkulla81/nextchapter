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

  // Someone who has finished onboarding has no use for this page; someone who has just created their account (the
  // bundles flow creates it before the payoff) sees their grade, then goes on to the welcome.
  const registered = !!profile.registrationCompletedAt
  if (registered && profile.introCommittedAt) {
    redirect('/dashboard')
  }

  const { grade, proofOfWork } = await getScoreRevealData(profile.id)
  const cta = registered
    ? { href: '/onboarding/welcome', label: 'Continue' }
    : { href: '/onboarding/create-account', label: 'Create your account to get your full report and action plan' }

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        {profile.firstName ? `Nice work, ${profile.firstName}!` : 'Your Market Reality Assessment'}
      </h1>

      <Button nativeButton={false} render={<Link href={cta.href} />}>
        {cta.label}
      </Button>

      <ScoreRevealSection initialGrade={grade} initialProofOfWork={proofOfWork} />

      {/* Repeats the top CTA — the grade legend above makes this a long
          scroll, and a candidate who reads all the way through shouldn't
          have to scroll back up to act on it. */}
      <Button nativeButton={false} render={<Link href={cta.href} />}>
        {cta.label}
      </Button>
    </div>
  )
}
