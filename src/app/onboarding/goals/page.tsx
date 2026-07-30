import { getCandidateProfileForUser } from '@/lib/onboarding/get-profile'
import { GoalsForm } from '@/components/onboarding/GoalsForm'
import { prisma } from '@/lib/prisma'
import { inferIndustriesFromWorkHistory } from '@/lib/onboarding/infer-industries'

export default async function GoalsPage() {
  const profile = await getCandidateProfileForUser()

  const workHistory = await prisma.workHistoryEntry.findMany({
    where: { candidateId: profile.id },
    orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }],
  })

  const inferredIndustries = inferIndustriesFromWorkHistory(workHistory)

  // A target function starts as a guess at "more of the same" — the
  // candidate's own resume-derived background — not a separate inference
  // pass. They can change it right there if they're pivoting.
  const inferredFunction = profile.primaryFunction ?? null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {profile.firstName
            ? `Last step, ${profile.firstName}. Tell us about what you're looking for.`
            : "Last step. Tell us about what you're looking for."}
        </h1>
      </div>
      <GoalsForm profile={profile} inferredIndustries={inferredIndustries} inferredFunction={inferredFunction} />
    </div>
  )
}
