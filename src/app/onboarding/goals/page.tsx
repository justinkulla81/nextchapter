import { getCandidateProfileForUser } from '@/lib/onboarding/get-profile'
import { GoalsForm } from '@/components/onboarding/GoalsForm'
import { prisma } from '@/lib/prisma'

export default async function GoalsPage() {
  const profile = await getCandidateProfileForUser()

  const workHistory = await prisma.workHistoryEntry.findMany({
    where: { candidateId: profile.id },
    orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }],
  })
  const inferredIndustries: string[] = []
  for (const entry of workHistory) {
    if (entry.companyIndustry && !inferredIndustries.includes(entry.companyIndustry)) {
      inferredIndustries.push(entry.companyIndustry)
    }
    if (inferredIndustries.length >= 3) break
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {profile.firstName
            ? `Last step, ${profile.firstName}. Tell us about what you're looking for.`
            : "Last step. Tell us about what you're looking for."}
        </h1>
      </div>
      <GoalsForm profile={profile} inferredIndustries={inferredIndustries} />
    </div>
  )
}
