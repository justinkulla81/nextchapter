import { getCandidateProfileForUser } from '@/lib/onboarding/get-profile'
import { DetailsForm } from '@/components/onboarding/DetailsForm'
import { prisma } from '@/lib/prisma'
import { entryOf } from '@/lib/onboarding/resume-rule'

// Who we are building this for. A name and an email are needed before an account can exist; LinkedIn is optional.
// Reached after skipping the résumé, when a résumé held no name or email, and by a registered member with no name on file.
export default async function OnboardingDetailsPage() {
  const profile = await getCandidateProfileForUser()
  const hasResume = (await prisma.resume.count({ where: { candidateId: profile.id, looksLikeResume: { not: false } } })) > 0
  const marketReality = entryOf(profile.journeyDetails) !== null

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight text-balance text-ink">
          {hasResume ? 'We could not find everything on your résumé.' : 'Tell us who this is for.'}
        </h1>
        <p className="text-base text-muted-foreground">
          <span className="font-semibold text-ink">Why we ask: </span>
          your name goes on your profile and your report, and your email is where your confirmation link goes.
          {!hasResume && marketReality && ' Add a résumé later and your Market Reality sharpens.'}
        </p>
      </div>
      <DetailsForm
        defaults={{ firstName: profile.firstName ?? '', lastName: profile.lastName ?? '', email: profile.email ?? '', linkedInUrl: profile.linkedInUrl ?? '' }}
      />
    </div>
  )
}
