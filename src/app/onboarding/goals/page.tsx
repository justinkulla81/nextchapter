import { getCandidateProfileForUser } from '@/lib/onboarding/get-profile'
import { GoalsForm } from '@/components/onboarding/GoalsForm'
import { prisma } from '@/lib/prisma'

export default async function GoalsPage() {
  const profile = await getCandidateProfileForUser()

  const workHistory = await prisma.workHistoryEntry.findMany({
    where: { candidateId: profile.id },
    orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }],
  })

  // Rank by total time spent in each industry, not just recency — a single
  // long tenure early in a career is as strong a signal as a short recent
  // stint. Recency only breaks ties between industries of similar duration.
  const durationByIndustry = new Map<string, number>()
  const recencyRankByIndustry = new Map<string, number>()
  workHistory.forEach((entry, index) => {
    if (!entry.companyIndustry) return
    const end = entry.endDate ?? new Date()
    const months = Math.max(0, (end.getTime() - entry.startDate.getTime()) / (1000 * 60 * 60 * 24 * 30))
    durationByIndustry.set(entry.companyIndustry, (durationByIndustry.get(entry.companyIndustry) ?? 0) + months)
    if (!recencyRankByIndustry.has(entry.companyIndustry)) {
      recencyRankByIndustry.set(entry.companyIndustry, index)
    }
  })
  const inferredIndustries = [...durationByIndustry.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1]
      return (recencyRankByIndustry.get(a[0]) ?? 0) - (recencyRankByIndustry.get(b[0]) ?? 0)
    })
    .slice(0, 3)
    .map(([industry]) => industry)

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
