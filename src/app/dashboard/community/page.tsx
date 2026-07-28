import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { getCommunityFeed } from '@/lib/community/community-feed'
import { FEED_ITEM_STYLE } from '@/lib/community/feed-item-style'
import { getUnreadEncouragementNotes } from '@/lib/community/encouragement'
import { buildSelfIntroDraft } from '@/lib/community/self-intro'
import { getCohortInfo } from '@/lib/community/layoff-cohort'
import { getCandidateThreads, getThreadWithMessages, markThreadRead } from '@/lib/messaging/threads'
import { CommunityPostForm } from '@/components/dashboard/CommunityPostForm'
import { CommunityPostCard } from '@/components/dashboard/CommunityPostCard'
import { CommunityFilterBar } from '@/components/dashboard/CommunityFilterBar'
import { SelfIntroForm } from '@/components/dashboard/SelfIntroForm'
import { dismissEncouragementNote } from '@/app/dashboard/community/actions'
import { sendCandidateMessage } from '@/app/dashboard/messages/actions'
import { SendEncouragementForm } from '@/components/dashboard/SendEncouragementForm'
import { MessageBubbles } from '@/components/messaging/MessageBubbles'
import { MessageComposer } from '@/components/messaging/MessageComposer'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { AvatarDisplay } from '@/components/ui/avatar-display'
import { cn } from '@/lib/utils'

const PARTNER_TYPE_LABEL = {
  COACH: 'Coach',
  RECRUITER: 'Recruiter',
  EMPLOYER: 'Employer',
} as const

type SearchParams = {
  tab?: string
  thread?: string
  city?: string
  function?: string
  industry?: string
}

export default async function SupportNetworkPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const profile = await getDashboardData()
  const params = await searchParams
  const tab = params.tab === 'messages' ? 'messages' : 'community'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Support network</h1>
        <p className="mt-1 text-muted-foreground">
          Peers going through it with you, and the people helping you land the job.
        </p>
      </div>

      <div className="flex gap-6 border-b border-border">
        <Link
          href="/dashboard/community?tab=community"
          className={cn(
            'border-b-2 pb-2 text-sm font-medium transition-colors',
            tab === 'community' ? 'border-brand text-foreground' : 'border-transparent text-muted-foreground'
          )}
        >
          Community messages
        </Link>
        <Link
          href="/dashboard/community?tab=messages"
          className={cn(
            'border-b-2 pb-2 text-sm font-medium transition-colors',
            tab === 'messages' ? 'border-brand text-foreground' : 'border-transparent text-muted-foreground'
          )}
        >
          Private messages
        </Link>
      </div>

      {tab === 'messages' ? (
        <PrivateMessagesTab candidateId={profile.id} threadId={params.thread} />
      ) : (
        <CommunityTab
          candidateId={profile.id}
          privacyTier={profile.privacyTier}
          encouragementGivingOptIn={profile.encouragementGivingOptIn}
          layoffCohortId={profile.layoffCohortId}
          firstName={profile.firstName}
          primaryFunction={profile.primaryFunction}
          targetRoleType={profile.targetRoleType}
          currentCity={profile.currentCity}
          industryContext={profile.industryContext}
          searchParams={params}
        />
      )}
    </div>
  )
}

async function PrivateMessagesTab({ candidateId, threadId }: { candidateId: string; threadId?: string }) {
  const threads = await getCandidateThreads(candidateId)

  let activeThread: Awaited<ReturnType<typeof getThreadWithMessages>> | null = null
  if (threadId) {
    const thread = await getThreadWithMessages(threadId)
    if (!thread || thread.candidateId !== candidateId) notFound()
    activeThread = thread
    // Viewing the thread is the read signal, same as Community's
    // communityLastViewedAt pattern — no separate client-side effect needed.
    await markThreadRead(thread.id, 'candidate')
  }

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start">
      <div className="shrink-0 divide-y divide-border rounded-lg border border-border md:w-64">
        {threads.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No conversations yet. Your coach, a recruiter, or an employer you&apos;ve approved will
            show up here once they reach out.
          </p>
        ) : (
          threads.map((thread) => (
            <Link
              key={thread.id}
              href={`/dashboard/community?tab=messages&thread=${thread.id}`}
              className={cn(
                'flex items-center justify-between gap-3 p-3 hover:bg-muted',
                thread.id === threadId && 'bg-muted'
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <AvatarDisplay name={thread.partnerName} url={thread.partnerAvatarUrl} size={32} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{thread.partnerName}</p>
                  <p className="text-xs text-muted-foreground">{PARTNER_TYPE_LABEL[thread.partnerType]}</p>
                </div>
              </div>
              {thread.unread && (
                <span className="shrink-0 rounded-full bg-orange/20 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-orange uppercase">
                  New
                </span>
              )}
            </Link>
          ))
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-4">
        {!activeThread ? (
          <p className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
            {threads.length === 0
              ? 'Nothing to show yet.'
              : 'Pick a conversation to read and reply.'}
          </p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <AvatarDisplay name={partnerNameFor(activeThread)} url={activeThread.partnerAvatarUrl} size={32} />
              <h2 className="text-lg font-semibold tracking-tight">{partnerNameFor(activeThread)}</h2>
            </div>
            <div className="rounded-lg border border-border">
              <MessageBubbles
                messages={activeThread.messages}
                selfRole="CANDIDATE"
                partnerName={partnerNameFor(activeThread)}
                partnerAvatarUrl={activeThread.partnerAvatarUrl}
              />
            </div>
            <MessageComposer threadId={activeThread.id} action={sendCandidateMessage} />
          </>
        )}
      </div>
    </div>
  )
}

function partnerNameFor(thread: { coach: { fullName: string } | null; recruiter: { fullName: string } | null; employer: { companyName: string } | null }) {
  return thread.coach?.fullName ?? thread.recruiter?.fullName ?? thread.employer?.companyName ?? 'NextChapter contact'
}

async function CommunityTab({
  candidateId,
  privacyTier,
  encouragementGivingOptIn,
  layoffCohortId,
  firstName,
  primaryFunction,
  targetRoleType,
  currentCity,
  industryContext,
  searchParams,
}: {
  candidateId: string
  privacyTier: string
  encouragementGivingOptIn: boolean
  layoffCohortId: string | null
  firstName: string | null
  primaryFunction: string | null
  targetRoleType: string | null
  currentCity: string | null
  industryContext: string | null
  searchParams: SearchParams
}) {
  const canParticipate = privacyTier === 'PUBLIC' || privacyTier === 'SEMI_PUBLIC'

  if (!canParticipate) {
    return (
      <div className="rounded-lg border border-border p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Posting and expressing interest requires a Public or Semi-Public profile — you can&apos;t
          meaningfully network anonymously.
        </p>
        <Button nativeButton={false} render={<Link href="/dashboard/privacy" />} className="mt-4">
          Update privacy settings
        </Button>
      </div>
    )
  }

  // Resets the Support Network nav badge's baseline the moment they can
  // actually see feed content — whether that's the intro-gated preview
  // below or the full feed further down.
  await prisma.candidateProfile.update({
    where: { id: candidateId },
    data: { communityLastViewedAt: new Date() },
  })

  const hasIntroduced = await prisma.communityPost.findFirst({
    where: { candidateId, postType: 'SELF_INTRO' },
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
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            First, introduce yourself — a real post that shows up in the feed like anyone else&apos;s,
            so people here know who they&apos;re talking to before they see your other posts.
          </p>
          <SelfIntroForm
            defaultValue={buildSelfIntroDraft({
              candidateId,
              firstName,
              primaryFunction,
              targetRoleType,
              currentCity,
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
                    className={`flex items-start gap-2 rounded-lg border-l-4 border border-border p-4 text-sm text-foreground ${style.borderClass}`}
                  >
                    {item.displayName && <AvatarDisplay name={item.displayName} url={item.avatarUrl} size={24} />}
                    <p>
                      <span className="mr-1">{style.icon}</span>
                      {item.displayName && <span className="font-medium">{item.displayName}</span>}{' '}
                      {item.detail}
                    </p>
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
  const cityFilter = searchParams.city ?? ''
  const functionFilter = searchParams.function ?? ''
  const industryFilter = searchParams.industry ?? ''

  const [posts, feed, unreadNotes, cohort] = await Promise.all([
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
    getUnreadEncouragementNotes(candidateId),
    layoffCohortId ? getCohortInfo(layoffCohortId, candidateId) : Promise.resolve(null),
  ])

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">
        Ask for help, offer help, or share a job — nobody searches well entirely alone.
      </p>

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

      {cohort && (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div>
            <p className="text-sm font-medium text-foreground">Your cohort: {cohort.companyName}</p>
            <p className="text-sm text-muted-foreground">
              {cohort.memberCount} other{cohort.memberCount === 1 ? '' : 's'} from the{' '}
              {cohort.layoffDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}{' '}
              layoff matched here — their posts are highlighted below.
            </p>
          </div>
          {cohort.posts.length > 0 && (
            <div className="space-y-3">
              {cohort.posts.slice(0, 5).map((post) => (
                <CommunityPostCard key={post.id} post={post} isOwnPost={false} />
              ))}
            </div>
          )}
        </div>
      )}

      {encouragementGivingOptIn ? (
        <SendEncouragementForm />
      ) : (
        <div className="rounded-lg border border-border bg-off-white p-4 text-sm text-muted-foreground">
          Want to send encouragement to someone here having a hard week?{' '}
          <Link href="/dashboard/privacy" className="text-primary underline underline-offset-4">
            Opt in from Privacy settings
          </Link>
          .
        </div>
      )}

      <CommunityPostForm />

      <CommunityFilterBar
        cityFilter={cityFilter}
        functionFilter={functionFilter}
        industryFilter={industryFilter}
        ownCity={currentCity}
        ownFunction={primaryFunction}
        ownIndustry={industryContext}
      />

      {posts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No posts match these filters yet.</p>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <CommunityPostCard key={post.id} post={post} isOwnPost={post.candidateId === candidateId} />
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
                  className={`flex items-start gap-2 rounded-lg border-l-4 border border-border p-4 text-sm text-foreground ${style.borderClass}`}
                >
                  {item.displayName && <AvatarDisplay name={item.displayName} url={item.avatarUrl} size={24} />}
                  <p>
                    <span className="mr-1">{style.icon}</span>
                    {item.displayName && <span className="font-medium">{item.displayName}</span>}{' '}
                    {item.detail}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {item.occurredAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </p>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
