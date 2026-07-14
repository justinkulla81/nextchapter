import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { CommunityPostForm } from '@/components/dashboard/CommunityPostForm'
import { CommunityPostCard } from '@/components/dashboard/CommunityPostCard'
import { CommunityFilterBar } from '@/components/dashboard/CommunityFilterBar'
import { Button } from '@/components/ui/button'

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string; function?: string; industry?: string }>
}) {
  const profile = await getDashboardData()
  const params = await searchParams

  const canParticipate = profile.privacyTier === 'PUBLIC' || profile.privacyTier === 'SEMI_PUBLIC'

  if (!canParticipate) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Community Board</h1>
          <p className="mt-1 text-muted-foreground">
            Candidates post jobs, projects, and intros for each other — organized by city,
            function, and industry.
          </p>
        </div>
        <div className="rounded-lg border border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Posting and expressing interest requires a Public or Semi-Public profile — you can&apos;t
            meaningfully network anonymously.
          </p>
          <Button render={<Link href="/dashboard/privacy" />} className="mt-4">
            Update privacy settings
          </Button>
        </div>
      </div>
    )
  }

  // Each filter dimension defaults to the viewer's own profile value, but can
  // be broadened/cleared independently via the "city"/"function"/"industry"
  // search params (empty string = "All").
  const cityFilter = params.city ?? profile.currentCity ?? ''
  const functionFilter = params.function ?? profile.primaryFunction ?? ''
  const industryFilter = params.industry ?? profile.industryContext ?? ''

  const posts = await prisma.communityPost.findMany({
    where: {
      isActive: true,
      ...(cityFilter && { postCity: cityFilter }),
      ...(functionFilter && { postFunction: functionFilter }),
      ...(industryFilter && { postIndustry: industryFilter }),
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Community Board</h1>
        <p className="mt-1 text-muted-foreground">
          Candidates post jobs, projects, and intros for each other — organized by city,
          function, and industry.
        </p>
      </div>

      <CommunityPostForm />

      <CommunityFilterBar
        cityFilter={cityFilter}
        functionFilter={functionFilter}
        industryFilter={industryFilter}
        ownCity={profile.currentCity}
        ownFunction={profile.primaryFunction}
        ownIndustry={profile.industryContext}
      />

      {posts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No posts match these filters yet.</p>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <CommunityPostCard key={post.id} post={post} isOwnPost={post.candidateId === profile.id} />
          ))}
        </div>
      )}
    </div>
  )
}
