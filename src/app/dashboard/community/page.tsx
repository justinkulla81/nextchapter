import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { getCommunityFeed } from '@/lib/community/community-feed'
import { getMarketBriefFeedItems } from '@/lib/community/market-content'
import { mergeCommunityStream } from '@/lib/community/unified-feed'
import { getUnreadEncouragementNotes } from '@/lib/community/encouragement'
import { getSupportNetworkUnreadCount } from '@/lib/community/unread-count'
import { buildSelfIntroDraft } from '@/lib/community/self-intro'
import { getCohortInfo } from '@/lib/community/layoff-cohort'
import {
  syncAutoJoinedCommunities,
  getPendingAutoJoinNotices,
  getCandidateCommunities,
  communityPostWhere,
} from '@/lib/community/communities'
import {
  getCandidateThreads,
  getThreadWithMessages,
  getCandidateUnreadCount,
  markThreadRead,
  getCandidateEligibleRecruiters,
  getCandidateEligibleEmployers,
} from '@/lib/messaging/threads'
import { getPeerThreads, getPeerThreadWithMessages, getPeerUnreadCount, getOrCreatePeerThread, markPeerThreadRead } from '@/lib/messaging/peer-threads'
import { PeerMessageBubbles } from '@/components/messaging/PeerMessageBubbles'
import { PeerThreadSafetyControls } from '@/components/messaging/PeerThreadSafetyControls'
import { sendPeerCandidateMessage } from '@/app/dashboard/community/actions'
import { startCandidateThreadAction } from '@/app/dashboard/messages/actions'
import { EmptyState } from '@/components/ui/empty-state'
import { Inbox } from 'lucide-react'
import type { ThreadPartnerType } from '@prisma/client'
import { CommunityPostForm } from '@/components/dashboard/CommunityPostForm'
import { CommunityPostCard } from '@/components/dashboard/CommunityPostCard'
import { CommunityStreamItem } from '@/components/dashboard/CommunityStreamItem'
import { CommunityChips } from '@/components/dashboard/CommunityChips'
import { CommunityAutoJoinBanner } from '@/components/dashboard/CommunityAutoJoinBanner'
import { CommunityGroupStrip } from '@/components/dashboard/CommunityGroupStrip'
import { getCandidateGroups } from '@/lib/community/groups'
import { hasQualifyingCommunityBadge } from '@/lib/community/access'
import { SelfIntroForm } from '@/components/dashboard/SelfIntroForm'
import { dismissEncouragementNote } from '@/app/dashboard/community/actions'
import { sendCandidateMessage } from '@/app/dashboard/messages/actions'
import { SendEncouragementForm } from '@/components/dashboard/SendEncouragementForm'
import { MessageBubbles } from '@/components/messaging/MessageBubbles'
import { MessageComposer } from '@/components/messaging/MessageComposer'
import { SubmitButton } from '@/components/ui/submit-button'
import { AvatarDisplay } from '@/components/ui/avatar-display'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'
import { PrivacyTierSelector } from '@/components/candidates/PrivacyTierSelector'
import { cn } from '@/lib/utils'
import type { Prisma, PrivacyTier } from '@prisma/client'

export const metadata: Metadata = { title: 'Support Network' }


const PARTNER_TYPE_LABEL = {
  COACH: 'Coach',
  RECRUITER: 'Recruiter',
  EMPLOYER: 'Employer',
  // Never actually rendered here — getCandidateThreads only returns
  // COACH/RECRUITER/EMPLOYER threads, PEER threads have their own tab — but
  // ThreadPartnerType now includes PEER, so this keeps the lookup exhaustive.
  PEER: 'Community',
} as const

type Relation = 'peers' | 'coaches' | 'recruiters' | 'hiring-managers'

const RELATIONS: Relation[] = ['peers', 'coaches', 'recruiters', 'hiring-managers']

const RELATION_LABEL: Record<Relation, string> = {
  peers: 'Peers',
  coaches: 'Coaches',
  recruiters: 'Recruiters',
  'hiring-managers': 'Hiring Managers',
}

function isRelation(value: string | undefined): value is Relation {
  return !!value && (RELATIONS as string[]).includes(value)
}

function relationForPartnerType(partnerType: ThreadPartnerType): Relation {
  if (partnerType === 'COACH') return 'coaches'
  if (partnerType === 'RECRUITER') return 'recruiters'
  if (partnerType === 'EMPLOYER') return 'hiring-managers'
  return 'peers'
}

type SearchParams = {
  tab?: string
  thread?: string
  with?: string
  relation?: string
  community?: string
  group?: string
}

// `?group=dimension:value` — a fixed-size fact about the candidate (their
// school/companies/industry-bucket/metro/function), not a picker among
// alternatives, so it's a separate query param from the free-text
// city/function/industry filter bar above it.
function communityGroupWhere(group: string | undefined): Prisma.CommunityPostWhereInput {
  if (!group) return {}
  const [dimension, ...rest] = group.split(':')
  const value = rest.join(':')
  if (!value) return {}
  switch (dimension) {
    case 'seniority':
      return { postSeniorityBand: value }
    case 'school':
      return { postSchools: { has: value } }
    case 'company':
      return { postCompanies: { has: value } }
    case 'industry':
      return { postIndustryBucket: value }
    case 'metro':
      return { postMetroArea: value }
    case 'function':
      return { postFunction: value }
    default:
      return {}
  }
}

// §14's moderation gate: a candidate's own post is always visible to them
// (including while HELD or REMOVED, so they see the outcome of their own
// post rather than it just vanishing), but everyone else only ever sees
// PUBLISHED posts. Applied to every CommunityPost.findMany in this file.
function communityModerationWhere(candidateId: string): Prisma.CommunityPostWhereInput {
  return { OR: [{ moderationStatus: 'PUBLISHED' }, { candidateId }] }
}

export default async function SupportNetworkPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const profile = await getDashboardData()
  const params = await searchParams
  const tab = params.tab === 'messages' ? 'messages' : 'community'

  // Computed off the profile snapshot already in hand, before CommunityTab's
  // unconditional communityLastViewedAt reset fires later in this same
  // request — reading it after that reset would always show zero.
  const [communityUnreadCount, messagesUnreadCount, peerUnreadCount] = await Promise.all([
    getSupportNetworkUnreadCount(profile.id, profile.communityLastViewedAt),
    getCandidateUnreadCount(profile.id),
    getPeerUnreadCount(profile.id),
  ])

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Support Network</h1>
        <PageHeaderBoxes pageKey="community" candidateId={profile.id} />
      </div>

      <div className="flex gap-6 border-b border-border">
        <Link
          href="/dashboard/community?tab=community"
          className={cn(
            'flex items-center gap-1.5 border-b-2 pb-2 text-sm font-medium transition-colors',
            tab === 'community' ? 'border-brand text-foreground' : 'border-transparent text-muted-foreground'
          )}
        >
          Community messages
          {communityUnreadCount > 0 && (
            <span className="rounded-full bg-orange/20 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-orange uppercase tabular-nums">
              {communityUnreadCount}
            </span>
          )}
        </Link>
        <Link
          href="/dashboard/community?tab=messages"
          className={cn(
            'flex items-center gap-1.5 border-b-2 pb-2 text-sm font-medium transition-colors',
            tab === 'messages' ? 'border-brand text-foreground' : 'border-transparent text-muted-foreground'
          )}
        >
          Messages
          {messagesUnreadCount + peerUnreadCount > 0 && (
            <span className="rounded-full bg-orange/20 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-orange uppercase tabular-nums">
              {messagesUnreadCount + peerUnreadCount}
            </span>
          )}
        </Link>
      </div>

      {tab === 'messages' ? (
        <MessagesTab
          candidateId={profile.id}
          relationParam={params.relation}
          threadId={params.thread}
          withCandidateId={params.with}
        />
      ) : (
        <CommunityTab
          candidateId={profile.id}
          privacyTier={profile.privacyTier}
          privacyOpenedUpBonusAt={profile.privacyOpenedUpBonusAt}
          encouragementGivingOptIn={profile.encouragementGivingOptIn}
          layoffCohortId={profile.layoffCohortId}
          firstName={profile.firstName}
          primaryFunction={profile.primaryFunction}
          targetRoleType={profile.targetRoleType}
          currentCity={profile.currentCity}
          searchParams={params}
        />
      )}
    </div>
  )
}

// Unified Messages tab (Community/Messaging rework, Phase 3) — one surface,
// 4 relationship-based sub-tabs (Peers/Coaches/Recruiters/Hiring Managers),
// replacing the old 3-way Community DMs / Private messages / Peer split.
async function MessagesTab({
  candidateId,
  relationParam,
  threadId,
  withCandidateId,
}: {
  candidateId: string
  relationParam?: string
  threadId?: string
  withCandidateId?: string
}) {
  const [candidateThreads, peerThreads] = await Promise.all([
    getCandidateThreads(candidateId),
    getPeerThreads(candidateId),
  ])

  let relation: Relation
  if (isRelation(relationParam)) {
    relation = relationParam
  } else if (threadId && peerThreads.some((t) => t.id === threadId)) {
    relation = 'peers'
  } else if (threadId) {
    const match = candidateThreads.find((t) => t.id === threadId)
    relation = match ? relationForPartnerType(match.partnerType) : 'peers'
  } else {
    relation = 'peers'
  }

  const coachThreads = candidateThreads.filter((t) => t.partnerType === 'COACH')
  const recruiterThreads = candidateThreads.filter((t) => t.partnerType === 'RECRUITER')
  const employerThreads = candidateThreads.filter((t) => t.partnerType === 'EMPLOYER')

  const relationUnread: Record<Relation, number> = {
    peers: peerThreads.filter((t) => t.unread).length,
    coaches: coachThreads.filter((t) => t.unread).length,
    recruiters: recruiterThreads.filter((t) => t.unread).length,
    'hiring-managers': employerThreads.filter((t) => t.unread).length,
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {RELATIONS.map((r) => (
          <Link
            key={r}
            href={`/dashboard/community?tab=messages&relation=${r}`}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
              relation === r
                ? 'border-brand bg-brand/10 text-foreground'
                : 'border-border text-muted-foreground hover:text-foreground'
            )}
          >
            {RELATION_LABEL[r]}
            {relationUnread[r] > 0 && (
              <span className="rounded-full bg-orange/20 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-orange uppercase tabular-nums">
                {relationUnread[r]}
              </span>
            )}
          </Link>
        ))}
      </div>

      {relation === 'peers' ? (
        <PeerRelationPanel candidateId={candidateId} threadId={threadId} withCandidateId={withCandidateId} />
      ) : (
        <InstitutionalRelationPanel
          candidateId={candidateId}
          relation={relation}
          threads={
            relation === 'coaches' ? coachThreads : relation === 'recruiters' ? recruiterThreads : employerThreads
          }
          threadId={threadId}
        />
      )}
    </div>
  )
}

async function PeerRelationPanel({
  candidateId,
  threadId,
  withCandidateId,
}: {
  candidateId: string
  threadId?: string
  withCandidateId?: string
}) {
  // A "Message" link with no existing thread yet (?with={candidateId})
  // creates it on the fly, same first-contact path the send action itself
  // uses — so clicking "Message" on a post and then landing here already
  // shows the (empty) conversation instead of an error.
  let resolvedThreadId = threadId
  if (!resolvedThreadId && withCandidateId && withCandidateId !== candidateId) {
    try {
      const thread = await getOrCreatePeerThread(candidateId, withCandidateId)
      resolvedThreadId = thread.id
    } catch {
      // Blocked or rate-limited — fall through to the plain thread list;
      // the composer below will surface the real error if they retry.
    }
  }

  const threads = await getPeerThreads(candidateId)

  let activeThread: Awaited<ReturnType<typeof getPeerThreadWithMessages>> | null = null
  if (resolvedThreadId) {
    activeThread = await getPeerThreadWithMessages(resolvedThreadId, candidateId)
    if (activeThread) await markPeerThreadRead(resolvedThreadId, candidateId)
  }

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start">
      <div className="shrink-0 divide-y divide-border rounded-lg border border-border md:w-64">
        {threads.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No conversations yet.
          </p>
        ) : (
          threads.map((thread) => (
            <Link
              key={thread.id}
              href={`/dashboard/community?tab=messages&relation=peers&thread=${thread.id}`}
              className={cn(
                'flex items-center justify-between gap-3 p-3 hover:bg-muted',
                thread.id === resolvedThreadId && 'bg-muted'
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <AvatarDisplay name={thread.partnerName} url={thread.partnerAvatarUrl} size={32} />
                <p className="truncate text-sm font-medium text-foreground">{thread.partnerName}</p>
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
            {threads.length === 0 ? 'Nothing to show yet.' : 'Pick a conversation to read and reply.'}
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AvatarDisplay name={activeThread.partnerName} url={activeThread.partnerAvatarUrl} size={32} />
                <h2 className="text-lg font-semibold tracking-tight">{activeThread.partnerName}</h2>
              </div>
              {activeThread.partnerCandidateId && (
                <PeerThreadSafetyControls
                  threadId={activeThread.id}
                  otherCandidateId={activeThread.partnerCandidateId}
                  isBlocked={activeThread.isBlocked}
                  isReported={!!activeThread.reportedAt}
                />
              )}
            </div>
            <div className="rounded-lg border border-border">
              <PeerMessageBubbles
                messages={activeThread.messages}
                selfCandidateId={candidateId}
                partnerName={activeThread.partnerName}
                partnerAvatarUrl={activeThread.partnerAvatarUrl}
              />
            </div>
            {activeThread.isBlocked ? (
              <p className="text-sm text-muted-foreground">
                You can no longer message in this conversation.
              </p>
            ) : (
              <MessageComposer threadId={activeThread.id} action={sendPeerCandidateMessage} />
            )}
          </>
        )}
      </div>
    </div>
  )
}

async function InstitutionalRelationPanel({
  candidateId,
  relation,
  threads,
  threadId,
}: {
  candidateId: string
  relation: Exclude<Relation, 'peers'>
  threads: Awaited<ReturnType<typeof getCandidateThreads>>
  threadId?: string
}) {
  const activeThreadId = threadId && threads.some((t) => t.id === threadId) ? threadId : undefined

  let activeThread: Awaited<ReturnType<typeof getThreadWithMessages>> | null = null
  if (activeThreadId) {
    const thread = await getThreadWithMessages(activeThreadId)
    if (!thread || thread.candidateId !== candidateId) notFound()
    activeThread = thread
    await markThreadRead(thread.id, 'candidate')
  }

  const partnerType: ThreadPartnerType =
    relation === 'coaches' ? 'COACH' : relation === 'recruiters' ? 'RECRUITER' : 'EMPLOYER'

  const rawEligible =
    relation === 'recruiters'
      ? await getCandidateEligibleRecruiters(candidateId)
      : relation === 'hiring-managers'
        ? await getCandidateEligibleEmployers(candidateId)
        : []
  const eligible = rawEligible.map((partner) => ({
    id: partner.id,
    name: 'fullName' in partner ? partner.fullName : partner.companyName,
    avatarUrl: partner.profilePictureUrl,
  }))

  if (threads.length === 0 && eligible.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title={
          relation === 'coaches'
            ? 'No coach conversations yet'
            : `No ${RELATION_LABEL[relation].toLowerCase()} conversations yet`
        }
        description={
          relation === 'coaches'
            ? "Once you're matched with a coach and consent to share your Coach Dossier, your conversation will show up here."
            : `You'll be able to message a ${relation === 'recruiters' ? 'recruiter' : 'hiring manager'} here once you have a real connection with one.`
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start">
      <div className="shrink-0 space-y-4 md:w-64">
        <div className="divide-y divide-border rounded-lg border border-border">
          {threads.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No conversations yet.</p>
          ) : (
            threads.map((thread) => (
              <Link
                key={thread.id}
                href={`/dashboard/community?tab=messages&relation=${relation}&thread=${thread.id}`}
                className={cn(
                  'flex items-center justify-between gap-3 p-3 hover:bg-muted',
                  thread.id === activeThreadId && 'bg-muted'
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

        {eligible.length > 0 && (
          <div className="space-y-2 rounded-lg border border-border p-3">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              People you can message
            </p>
            {eligible.map((partner) => (
              <form key={partner.id} action={startCandidateThreadAction.bind(null, partnerType, partner.id)}>
                <SubmitButton
                  variant="ghost"
                  className="flex h-auto w-full items-center justify-start gap-2 p-2 text-left"
                >
                  <AvatarDisplay name={partner.name} url={partner.avatarUrl} size={28} />
                  <span className="truncate text-sm font-medium text-foreground">{partner.name}</span>
                </SubmitButton>
              </form>
            ))}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-4">
        {!activeThread ? (
          <p className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
            {threads.length === 0
              ? 'Pick someone above to start a conversation.'
              : 'Pick a conversation to read and reply.'}
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AvatarDisplay name={partnerNameFor(activeThread)} url={activeThread.partnerAvatarUrl} size={32} />
                <h2 className="text-lg font-semibold tracking-tight">{partnerNameFor(activeThread)}</h2>
              </div>
              <PeerThreadSafetyControls
                threadId={activeThread.id}
                otherCandidateId={null}
                isBlocked={false}
                isReported={!!activeThread.reportedAt}
              />
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
  privacyOpenedUpBonusAt,
  encouragementGivingOptIn,
  layoffCohortId,
  firstName,
  primaryFunction,
  targetRoleType,
  currentCity,
  searchParams,
}: {
  candidateId: string
  privacyTier: PrivacyTier
  privacyOpenedUpBonusAt: Date | null
  encouragementGivingOptIn: boolean
  layoffCohortId: string | null
  firstName: string | null
  primaryFunction: string | null
  targetRoleType: string | null
  currentCity: string | null
  searchParams: SearchParams
}) {
  // §14: "Gate: any qualifying badge — Connected does not qualify." Replaces
  // the old privacyTier-only gate (community/access.ts's own comment
  // explains why both checks still matter). Privacy tier is checked first
  // since it's the cheaper, more common blocker — no need to compute
  // milestone badges for someone who hasn't opened up their profile yet.
  const privacyOk = privacyTier === 'PUBLIC' || privacyTier === 'SEMI_PUBLIC'

  if (!privacyOk) {
    return (
      <div className="space-y-4 rounded-lg border border-border p-6">
        <div>
          <p className="text-sm font-medium text-foreground">
            Posting, commenting, expressing interest, and sending encouragement all require a
            Public or Semi-Public profile — you can&apos;t meaningfully network anonymously.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a visibility below to unlock the Support Network — no need to leave this page.
          </p>
        </div>
        <PrivacyTierSelector currentTier={privacyTier} alreadyAwarded={!!privacyOpenedUpBonusAt} />
      </div>
    )
  }

  const hasQualifyingBadge = await hasQualifyingCommunityBadge(candidateId)

  if (!hasQualifyingBadge) {
    return (
      <div className="space-y-4 rounded-lg border border-border p-6">
        <div>
          <p className="text-sm font-medium text-foreground">
            Community unlocks once you&apos;ve earned any milestone badge.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Everyone here has done at least one real, verifiable thing to get in — a reference that
            came back, a resolved resume issue, a completed profile, a search streak. It&apos;s not
            about your privacy settings; it&apos;s about having done some real work first, so this
            isn&apos;t just a room for venting about the market.
          </p>
        </div>
        <Link
          href="/dashboard/stats"
          className="inline-flex items-center rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90"
        >
          See what unlocks it
        </Link>
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

  // Idempotent past the first visit — only creates a membership row for a
  // dimension (city/function/industry/ex-company) that has no row at all yet.
  await syncAutoJoinedCommunities(candidateId)

  const hasIntroduced = await prisma.communityPost.findFirst({
    where: { candidateId, postType: 'SELF_INTRO' },
    select: { id: true },
  })

  if (!hasIntroduced) {
    const [previewPosts, previewCommunityFeed, previewMarketBrief] = await Promise.all([
      prisma.communityPost.findMany({
        where: { isActive: true, ...communityModerationWhere(candidateId) },
        include: {
          candidate: { select: { firstName: true, lastName: true } },
          reactions: { where: { candidateId } },
          _count: { select: { reactions: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      getCommunityFeed(10),
      getMarketBriefFeedItems(3),
    ])
    const previewFeed = [...previewCommunityFeed, ...previewMarketBrief]

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

        {(previewPosts.length > 0 || previewFeed.length > 0) && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">What&apos;s happening here</h2>
            <div className="divide-y divide-border rounded-lg border border-border">
              {mergeCommunityStream(previewPosts, previewFeed).map((streamItem) => (
                <CommunityStreamItem
                  key={streamItem.kind === 'post' ? streamItem.post.id : streamItem.item.id}
                  item={streamItem}
                  candidateId={candidateId}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  const [communities, pendingAutoJoinNotices] = await Promise.all([
    getCandidateCommunities(candidateId),
    getPendingAutoJoinNotices(candidateId),
  ])
  const activeCommunity = communities.find((c) => c.communityId === searchParams.community) ?? null

  const [posts, communityFeed, marketBrief, unreadNotes, cohort, groups] = await Promise.all([
    prisma.communityPost.findMany({
      where: {
        isActive: true,
        ...communityPostWhere(activeCommunity),
        ...communityGroupWhere(searchParams.group),
        ...communityModerationWhere(candidateId),
      },
      include: {
        candidate: { select: { firstName: true, lastName: true } },
        reactions: { where: { candidateId } },
        _count: { select: { reactions: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    getCommunityFeed(),
    getMarketBriefFeedItems(),
    getUnreadEncouragementNotes(candidateId),
    layoffCohortId ? getCohortInfo(layoffCohortId, candidateId) : Promise.resolve(null),
    getCandidateGroups(candidateId),
  ])
  const feed = [...communityFeed, ...marketBrief]

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
              Other candidates from the{' '}
              {cohort.layoffDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}{' '}
              layoff are posting below — their posts are highlighted here.
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

      <CommunityAutoJoinBanner notices={pendingAutoJoinNotices} />

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

      <div className="overflow-hidden rounded-lg border border-border">
        <div className="border-b border-border bg-brand/5 px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Community Feed</p>
          <p className="text-xs text-muted-foreground">
            Post an update below, or browse what everyone else is sharing.
          </p>
        </div>

        <div className="border-b border-border p-4">
          <CommunityPostForm />
        </div>

        {(groups.length > 0 || communities.length > 0) && (
          <div className="space-y-2 border-b border-border bg-off-white/60 p-3">
            <CommunityGroupStrip
              groups={groups}
              otherParams={activeCommunity ? { community: activeCommunity.communityId } : {}}
            />
            <CommunityChips communities={communities} activeCommunityId={activeCommunity?.communityId} />
          </div>
        )}

        {posts.length === 0 && feed.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Nothing to show yet — check back soon.</p>
        ) : (
          <div className="divide-y divide-border">
            {mergeCommunityStream(posts, feed).map((streamItem) => (
              <CommunityStreamItem
                key={streamItem.kind === 'post' ? streamItem.post.id : streamItem.item.id}
                item={streamItem}
                candidateId={candidateId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
