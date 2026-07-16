import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { getCommunityFeed } from '@/lib/community/community-feed'
import { FEED_ITEM_STYLE } from '@/lib/community/feed-item-style'
import { getUnreadEncouragementNotes } from '@/lib/community/encouragement'
import { buildSelfIntroDraft } from '@/lib/community/self-intro'
import { CommunityPostForm } from '@/components/dashboard/CommunityPostForm'
import { CommunityPostCard } from '@/components/dashboard/CommunityPostCard'
import { CommunityFilterBar } from '@/components/dashboard/CommunityFilterBar'
import { SelfIntroForm } from '@/components/dashboard/SelfIntroForm'
import { dismissEncouragementNote } from '@/app/dashboard/community/actions'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'

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
          <h1 className="text-2xl font-semibold tracking-tight">Community</h1>
          <p className="mt-1 text-muted-foreground">
            Other NextChapter candidates — posts, encouragement, and a reminder you&apos;re not
            searching alone.
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

  const hasIntroduced = await prisma.communityPost.findFirst({
    where: { candidateId: profile.id, postType: 'SELF_INTRO' },
    select: { id: true },
  })

  if (!hasIntroduced) {
    const [previewPosts, previewFeed] = await Promise.all([
      prisma.communityPost.findMany({
        where: { isActive: true },
        include: { candidate: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      getCommunityFeed(10),
    ])

    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Community</h1>
          <p className="mt-1 text-muted-foreground">
            Other NextChapter candidates — posts, encouragement, and a reminder you&apos;re not
            searching alone.
          </p>
        </div>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            First, introduce yourself — a real post that shows up in the feed like anyone else&apos;s,
            so people here know who they&apos;re talking to before they see your other posts.
          </p>
          <SelfIntroForm
            defaultValue={buildSelfIntroDraft({
              candidateId: profile.id,
              firstName: profile.firstName,
              primaryFunction: profile.primaryFunction,
              targetRoleType: profile.targetRoleType,
              currentCity: profile.currentCity,
            })}
          />
        </div>

        {previewPosts.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-muted-foreground">What people are posting</h2>
            {previewPosts.map((post) => (
              <CommunityPostCard key={post.id} post={post} isOwnPost={false} />
            ))}
          </div>
        )}

        {previewFeed.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">Activity</h2>
            <div className="space-y-2">
              {previewFeed.map((item) => {
                const style = FEED_ITEM_STYLE[item.type]
                return (
                  <div
                    key={item.id}
                    className={`rounded-lg border-l-4 border border-border p-4 text-sm text-foreground ${style.borderClass}`}
                  >
                    <span className="mr-1">{style.icon}</span>
                    {item.displayName && <span className="font-medium">{item.displayName}</span>}{' '}
                    {item.detail}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Each filter dimension defaults to "All" (empty) unless the candidate
  // explicitly narrows it via the city/function/industry search params.
  const cityFilter = params.city ?? ''
  const functionFilter = params.function ?? ''
  const industryFilter = params.industry ?? ''

  const [posts, feed, unreadNotes] = await Promise.all([
    prisma.communityPost.findMany({
      where: {
        isActive: true,
        ...(cityFilter && { postCity: cityFilter }),
        ...(functionFilter && { postFunction: functionFilter }),
        ...(industryFilter && { postIndustry: industryFilter }),
      },
      include: { candidate: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    getCommunityFeed(),
    getUnreadEncouragementNotes(profile.id),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Community</h1>
        <p className="mt-1 text-muted-foreground">
          Ask for help, offer help, or share a job — nobody searches well entirely alone.
        </p>
      </div>

      {unreadNotes.length > 0 && (
        <div className="space-y-3">
          {unreadNotes.map((note) => (
            <div key={note.id} className="rounded-lg border border-border bg-brand/5 p-4">
              <p className="text-sm text-foreground">
                &ldquo;{note.message}&rdquo;
                {note.revealSender && note.fromCandidate.firstName && (
                  <span className="text-muted-foreground"> — {note.fromCandidate.firstName}</span>
                )}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Someone here sent you this.</p>
              <form action={dismissEncouragementNote.bind(null, note.id)} className="mt-2">
                <SubmitButton variant="outline" size="sm">
                  Dismiss
                </SubmitButton>
              </form>
            </div>
          ))}
        </div>
      )}

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

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Activity</h2>
        <div className="space-y-2">
          {feed.length === 0 ? (
            <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
              No activity yet this week — check back soon.
            </p>
          ) : (
            feed.map((item) => {
              const style = FEED_ITEM_STYLE[item.type]
              return (
                <div
                  key={item.id}
                  className={`rounded-lg border-l-4 border border-border p-4 text-sm text-foreground ${style.borderClass}`}
                >
                  <span className="mr-1">{style.icon}</span>
                  {item.displayName && <span className="font-medium">{item.displayName}</span>}{' '}
                  {item.detail}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {item.occurredAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
