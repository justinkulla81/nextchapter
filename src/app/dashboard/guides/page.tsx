import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { GUIDES } from '@/lib/constants/guides'
import { GuideCard } from '@/components/dashboard/GuideCard'

function isUnlocked(
  slug: string,
  profile: {
    networkComfortLevel: string | null
    contentComfortLevel: number | null
    contentVenues: string[]
    storyComfort: number | null
  },
  hasNarrative: boolean
): boolean {
  switch (slug) {
    case 'narrative-workshop':
      return hasNarrative
    case 'network-activation':
    case 'ask-for-help':
    case 'network-scripts':
      return profile.networkComfortLevel !== null
    case 'interview-prep':
      return profile.storyComfort !== null
    case 'thought-leadership':
      return profile.contentComfortLevel !== null && profile.contentVenues.length > 0
    default:
      return true
  }
}

export default async function GuidesPage() {
  const profile = await getDashboardData()
  const narrative = await prisma.candidateNarrative.findUnique({ where: { candidateId: profile.id } })

  const unlockedCount = GUIDES.filter((g) => isUnlocked(g.slug, profile, !!narrative)).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Free Guides</h1>
        <p className="mt-1 text-muted-foreground">
          {unlockedCount} of {GUIDES.length} unlocked. Some guides open right away — others unlock
          as you activate the matching part of your search below.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GUIDES.map((guide) => (
          <GuideCard key={guide.slug} guide={guide} unlocked={isUnlocked(guide.slug, profile, !!narrative)} />
        ))}
      </div>
    </div>
  )
}
