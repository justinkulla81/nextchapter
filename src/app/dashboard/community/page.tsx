import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { getCircleFeed } from '@/lib/community/circle-feed'
import { getUnreadEncouragementNotes } from '@/lib/community/encouragement'
import { CommunityPostForm } from '@/components/dashboard/CommunityPostForm'
import { CommunityPostCard } from '@/components/dashboard/CommunityPostCard'
import { CommunityFilterBar } from '@/components/dashboard/CommunityFilterBar'
import { SelfIntroForm } from '@/components/dashboard/SelfIntroForm'
import { EncouragementForm } from '@/components/dashboard/EncouragementForm'
import { dismissEncouragementNote } from '@/app/dashboard/circle/actions'
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
    return (
      <div className="space-y-6">
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
          <SelfIntroForm />
        </div>
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
      orderBy: { createdAt: 'desc' },
    }),
    getCircleFeed(),
    getUnreadEncouragementNotes(profile.id),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Community</h1>
        <p className="mt-1 text-muted-foreground">
          Post jobs, projects, and intros for each other, and send a bit of encouragement — nobody
          searches well entirely alone.
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
                <Button type="submit" variant="outline" size="sm">
                  Dismiss
                </Button>
              </form>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-border p-4">
        <h2 className="text-sm font-medium text-foreground">Send some encouragement</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Someone here is working through a hard week. Want to send them a quick note? It&apos;s
          anonymous unless you choose otherwise.
        </p>
        <div className="mt-3">
          <EncouragementForm />
        </div>
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

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Activity</h2>
        <div className="divide-y divide-border rounded-lg border border-border">
          {feed.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No activity yet this week — check back soon.</p>
          ) : (
            feed.map((item) => (
              <div key={item.id} className="p-4 text-sm text-foreground">
                <span className="font-medium">{item.displayName}</span> {item.detail}
                <span className="ml-2 text-xs text-muted-foreground">
                  {item.occurredAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
