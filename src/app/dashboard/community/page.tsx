import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { after } from 'next/server'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCommunityFeed } from '@/lib/community/community-feed'
import { getMarketBriefFeedItems } from '@/lib/community/market-content'
import { mergeCommunityStream } from '@/lib/community/unified-feed'
import { getUnreadEncouragementNotes } from '@/lib/community/encouragement'
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
  markThreadRead,
  getCandidateEligibleRecruiters,
  getCandidateEligibleEmployers,
} from '@/lib/messaging/threads'
import { getPeerThreads, getPeerThreadWithMessages, getOrCreatePeerThread, markPeerThreadRead } from '@/lib/messaging/peer-threads'
import { PeerMessageBubbles } from '@/components/messaging/PeerMessageBubbles'
import { PeerThreadSafetyControls } from '@/components/messaging/PeerThreadSafetyControls'
import { sendPeerCandidateMessage } from '@/app/dashboard/community/actions'
import { startCandidateThreadAction } from '@/app/dashboard/messages/actions'
import type { ThreadPartnerType } from '@prisma/client'
import { CommunityPostForm } from '@/components/dashboard/CommunityPostForm'
import { CommunityPostCard } from '@/components/dashboard/CommunityPostCard'
import { CommunityStreamItem } from '@/components/dashboard/CommunityStreamItem'
import { CommunityChips } from '@/components/dashboard/CommunityChips'
import { AlumniNetworkOptions } from '@/components/community/AlumniNetworkOptions'
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
import { PrivacyTierSelector } from '@/components/candidates/PrivacyTierSelector'
import { ConfidentialModeIndicator } from '@/components/dashboard/ConfidentialModeIndicator'
import { CommunityLeaderboardModule } from '@/components/dashboard/CommunityLeaderboardModule'
import { computeBoard } from '@/lib/leaderboard/queries'
import { communityIntro } from '@/lib/redesign/network-pages'
import { captureServerEvent } from '@/lib/posthog/server'
import { PageHeader } from '@/components/candidate/PageHeader'
import { ShowMore } from '@/components/candidate/ShowMore'
import { NetworkParts } from '@/components/network/NetworkParts'
import { SectionPills } from '@/components/candidate/SectionPills'
import { Section } from '@/components/candidate/ui'
import { EmptyCard } from '@/components/candidate/EmptyCard'
import { ActionLink } from '@/components/candidate/ActionLink'
import { Callout } from '@/components/candidate/Callout'
import { ThreadList } from '@/components/community/ThreadList'
import { relationLabel } from '@/lib/redesign/network-account'
import type { Prisma, PrivacyTier } from '@prisma/client'

export const metadata: Metadata = { title: 'NextChapter Community' }

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

// Sentence case for the redesigned circle switches.
const RELATION_LABEL_SENTENCE: Record<Relation, string> = {
  peers: 'Peers',
  coaches: 'Coaches',
  recruiters: 'Recruiters',
  'hiring-managers': 'Hiring managers',
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
  // Deep-linked from the resume page's "Send to a contact" action — a
  // resume id to pre-select in the composer's attachment picker.
  attachResumeId?: string
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
  const profile = await getDashboardProfile()
  const params = await searchParams
  const tab = params.tab === 'messages' ? 'messages' : 'community'
  captureServerEvent(profile.id, 'community_viewed', { tab, relation: params.relation ?? null })

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <PageHeader title={tab === 'messages' ? 'Messages' : 'Industry and function'} intro={communityIntro(tab)} />
        {tab === 'community' && <NetworkParts current="industry" />}
      </div>

      {tab === 'messages' ? (
        <MessagesTab
          candidateId={profile.id}
          relationParam={params.relation}
          threadId={params.thread}
          withCandidateId={params.with}
          attachResumeId={params.attachResumeId}
        />
      ) : (
        <CommunityTab
          candidateId={profile.id}
          privacyTier={profile.privacyTier}
          confidentialSearchMode={profile.confidentialSearchMode}
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
  attachResumeId,
}: {
  candidateId: string
  relationParam?: string
  threadId?: string
  withCandidateId?: string
  attachResumeId?: string
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
      <SectionPills
        label="Who you are messaging"
        current={relation}
        items={RELATIONS.map((r) => ({ key: r, label: relationLabel(RELATION_LABEL_SENTENCE[r], relationUnread[r]), href: `/dashboard/community?tab=messages&relation=${r}` }))}
      />

      {relation === 'peers' ? (
        <PeerRelationPanel
          candidateId={candidateId}
          threadId={threadId}
          withCandidateId={withCandidateId}
          attachResumeId={attachResumeId}
        />
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
  attachResumeId,
}: {
  candidateId: string
  threadId?: string
  withCandidateId?: string
  attachResumeId?: string
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

  const [threads, ownResumes] = await Promise.all([
    getPeerThreads(candidateId),
    prisma.resume.findMany({
      where: { candidateId },
      orderBy: { uploadedAt: 'desc' },
      select: { id: true, label: true, fileName: true },
    }),
  ])

  let activeThread: Awaited<ReturnType<typeof getPeerThreadWithMessages>> | null = null
  if (resolvedThreadId) {
    activeThread = await getPeerThreadWithMessages(resolvedThreadId, candidateId)
    if (activeThread) await markPeerThreadRead(resolvedThreadId, candidateId)
  }

  // Signed URLs for any resume attachments in this thread — resolved here
  // (not per-bubble) since a thread's attachment count is small and this
  // avoids one Suspense-wrapped async component per attached message.
  const attachedResumePaths = [
    ...new Set((activeThread?.messages ?? []).map((m) => m.attachedResume?.filePath).filter((p): p is string => !!p)),
  ]
  const attachmentUrls =
    attachedResumePaths.length > 0
      ? new Map(
          await Promise.all(
            attachedResumePaths.map(async (path) => {
              const admin = createAdminClient()
              const { data } = await admin.storage.from('resumes').createSignedUrl(path, 60 * 10)
              return [path, data?.signedUrl ?? null] as const
            })
          )
        )
      : new Map<string, string | null>()

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start">
      <ThreadList
        label="Conversations with peers"
        emptyText="No conversations yet. Message someone from a community post to start one."
        activeId={resolvedThreadId}
        threads={threads.map((t) => ({ id: t.id, name: t.partnerName, avatarUrl: t.partnerAvatarUrl, unread: t.unread, kind: null, href: `/dashboard/community?tab=messages&relation=peers&thread=${t.id}` }))}
      />
      <div className="min-w-0 flex-1 space-y-4">
        {!activeThread ? (
          <EmptyCard title={threads.length === 0 ? 'Nothing here yet' : 'Pick a conversation'} why={threads.length === 0 ? 'When you message another member, or they message you, the conversation shows up here.' : 'Choose someone on the left to read and reply.'} />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <AvatarDisplay name={activeThread.partnerName} url={activeThread.partnerAvatarUrl} size={40} />
                <h2 className="font-display text-xl font-semibold text-ink">{activeThread.partnerName}</h2>
              </div>
              {activeThread.partnerCandidateId && (
                <PeerThreadSafetyControls threadId={activeThread.id} otherCandidateId={activeThread.partnerCandidateId} isBlocked={activeThread.isBlocked} isReported={!!activeThread.reportedAt} />
              )}
            </div>
            <div className="rounded-2xl border border-border">
              <PeerMessageBubbles messages={activeThread.messages} selfCandidateId={candidateId} partnerName={activeThread.partnerName} partnerAvatarUrl={activeThread.partnerAvatarUrl} attachmentUrls={attachmentUrls} />
            </div>
            {activeThread.isBlocked ? (
              <p className="text-base text-ink">You can no longer message in this conversation.</p>
            ) : (
              <MessageComposer redesign threadId={activeThread.id} action={sendPeerCandidateMessage} resumeOptions={ownResumes.map((r) => ({ id: r.id, label: r.label || r.fileName }))} defaultAttachedResumeId={attachResumeId} />
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
      <EmptyCard
        title={relation === 'coaches' ? 'No coach conversations yet' : `No ${RELATION_LABEL_SENTENCE[relation].toLowerCase()} conversations yet`}
        why={
          relation === 'coaches'
            ? 'Once you are matched with a coach and agree to share your coach dossier, your conversation shows up here.'
            : `You can message a ${relation === 'recruiters' ? 'recruiter' : 'hiring manager'} here once you have a real connection with one.`
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start">
      <ThreadList
        label={`Conversations with ${RELATION_LABEL_SENTENCE[relation].toLowerCase()}`}
        emptyText="No conversations yet."
        activeId={activeThreadId}
        threads={threads.map((t) => ({ id: t.id, name: t.partnerName, avatarUrl: t.partnerAvatarUrl, unread: t.unread, kind: PARTNER_TYPE_LABEL[t.partnerType], href: `/dashboard/community?tab=messages&relation=${relation}&thread=${t.id}` }))}
      >
        {eligible.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-ink">People you can message</h3>
            <ul className="space-y-1">
              {eligible.map((partner) => (
                <li key={partner.id}>
                  <form action={startCandidateThreadAction.bind(null, partnerType, partner.id)}>
                    <SubmitButton variant="ghost" className="flex h-auto w-full items-center justify-start gap-3 rounded-xl p-2 text-left">
                      <AvatarDisplay name={partner.name} url={partner.avatarUrl} size={36} />
                      <span className="truncate text-base font-medium text-ink">{partner.name}</span>
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        )}
      </ThreadList>
      <div className="min-w-0 flex-1 space-y-4">
        {!activeThread ? (
          <EmptyCard
            title={threads.length === 0 ? 'Start a conversation' : 'Pick a conversation'}
            why={threads.length === 0 ? 'Choose someone under People you can message to say hello.' : 'Choose someone on the left to read and reply.'}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <AvatarDisplay name={partnerNameFor(activeThread)} url={activeThread.partnerAvatarUrl} size={40} />
                <h2 className="font-display text-xl font-semibold text-ink">{partnerNameFor(activeThread)}</h2>
              </div>
              <PeerThreadSafetyControls threadId={activeThread.id} otherCandidateId={null} isBlocked={false} isReported={!!activeThread.reportedAt} />
            </div>
            <div className="rounded-2xl border border-border">
              <MessageBubbles messages={activeThread.messages} selfRole="CANDIDATE" partnerName={partnerNameFor(activeThread)} partnerAvatarUrl={activeThread.partnerAvatarUrl} redesign />
            </div>
            <MessageComposer redesign threadId={activeThread.id} action={sendCandidateMessage} />
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
  confidentialSearchMode,
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
  confidentialSearchMode: boolean
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
  // Confidential Search Mode candidates pass this half of the gate too —
  // they still post/participate, always under a generated handle (see
  // resolveCommunityIdentity) rather than needing a public privacy tier.
  const privacyOk = privacyTier === 'PUBLIC' || privacyTier === 'SEMI_PUBLIC' || confidentialSearchMode

  if (!privacyOk) {
    return (
      <Section id="community-gate" title="Choose who can see you first">
        <p className="max-w-xl text-base text-ink">
          Posting, commenting, showing interest and sending encouragement need a Public or Semi-Public profile, because you cannot meaningfully network anonymously. Choose one below and you can start right away.
        </p>
        <PrivacyTierSelector currentTier={privacyTier} alreadyAwarded={!!privacyOpenedUpBonusAt} />
      </Section>
    )
  }

  const hasQualifyingBadge = await hasQualifyingCommunityBadge(candidateId)

  if (!hasQualifyingBadge) {
    return (
      <EmptyCard
        title="Community opens after your first milestone"
        why="Everyone here has done at least one real, verifiable thing to get in: a reference that came back, a résumé issue you fixed, a completed profile or a search streak. That keeps it a room for people doing the work. It has nothing to do with your privacy settings."
        action={
          <ActionLink variant="primary" href="/dashboard/stats" event="community_unlock_clicked" props={{ source: 'community_gate' }}>
            See what unlocks it
          </ActionLink>
        }
      />
    )
  }

  // Resets the Support Network nav badge's baseline the moment they can
  // actually see feed content — whether that's the intro-gated preview below
  // or the full feed further down. Nothing in this render reads the value
  // back, so it runs after the response instead of holding it up.
  after(() =>
    prisma.candidateProfile
      .update({ where: { id: candidateId }, data: { communityLastViewedAt: new Date() } })
      .catch((error) => console.error('Community last-viewed update failed:', error))
  )

  const [, hasIntroduced] = await Promise.all([
    // Idempotent past the first visit — only creates a membership row for a
    // dimension (city/function/industry/ex-company) that has no row at all yet.
    syncAutoJoinedCommunities(candidateId),
    prisma.communityPost.findFirst({
      where: { candidateId, postType: 'SELF_INTRO' },
      select: { id: true },
    }),
  ])

  if (!hasIntroduced) {
    const [previewPosts, previewCommunityFeed, previewMarketBrief] = await Promise.all([
      prisma.communityPost.findMany({
        where: { isActive: true, ...communityModerationWhere(candidateId) },
        include: {
          candidate: { select: { id: true, firstName: true, lastName: true, profilePictureUrl: true, confidentialSearchMode: true } },
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
        {confidentialSearchMode && <ConfidentialModeIndicator redesign />}
        <Section id="introduce" title="Introduce yourself first">
          <p className="max-w-xl text-base text-ink">
            Your introduction is a real post that shows up in the feed like anyone else&apos;s, so people here know who they are talking to before they see your other posts.
          </p>
          {confidentialSearchMode && (
            <Callout>Anything you write here is visible to other members. You post under a generated handle with no employer, title or location attached, but the words themselves are not private from the community.</Callout>
          )}
          <SelfIntroForm
            defaultValue={buildSelfIntroDraft({ candidateId, firstName, primaryFunction, targetRoleType, currentCity, confidentialSearchMode })}
          />
        </Section>
        {(previewPosts.length > 0 || previewFeed.length > 0) && (
          <Section id="happening" title="What is happening here">
            <div className="divide-y divide-border rounded-2xl border border-border">
              {mergeCommunityStream(previewPosts, previewFeed).map((streamItem) => (
                <CommunityStreamItem key={streamItem.kind === 'post' ? streamItem.post.id : streamItem.item.id} item={streamItem} candidateId={candidateId} />
              ))}
            </div>
          </Section>
        )}
      </div>
    )
  }

  // The posts query needs the selected community (from the community list); the
  // feed, notes, cohort, groups and leaderboard do not, so those load alongside
  // that chain instead of waiting behind it.
  const [{ communities, pendingAutoJoinNotices, posts }, [communityFeed, marketBrief, unreadNotes, cohort, groups, leaderboardTeaser]] =
    await Promise.all([
      (async () => {
        const [communities, pendingAutoJoinNotices] = await Promise.all([
          getCandidateCommunities(candidateId),
          getPendingAutoJoinNotices(candidateId),
        ])
        const activeCommunity = communities.find((c) => c.communityId === searchParams.community) ?? null
        const posts = await prisma.communityPost.findMany({
          where: {
            isActive: true,
            ...communityPostWhere(activeCommunity),
            ...communityGroupWhere(searchParams.group),
            ...communityModerationWhere(candidateId),
          },
          include: {
            candidate: { select: { id: true, firstName: true, lastName: true, profilePictureUrl: true, confidentialSearchMode: true } },
            reactions: { where: { candidateId } },
            _count: { select: { reactions: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
        return { communities, pendingAutoJoinNotices, posts }
      })(),
      Promise.all([
        getCommunityFeed(),
        getMarketBriefFeedItems(),
        getUnreadEncouragementNotes(candidateId),
        layoffCohortId ? getCohortInfo(layoffCohortId, candidateId) : Promise.resolve(null),
        getCandidateGroups(candidateId),
        // §19 — condensed top-3-of-Action-Score module. Skipped entirely for
        // Confidential Search Mode candidates: this is a public teaser inviting
        // opt-in, and §4.1 hard-excludes them from ever appearing here regardless.
        confidentialSearchMode ? Promise.resolve(null) : computeBoard('ACTION_SCORE', {}, candidateId),
      ]),
    ])
  const activeCommunity = communities.find((c) => c.communityId === searchParams.community) ?? null
  const feed = [...communityFeed, ...marketBrief]

  const filterActive = Boolean(activeCommunity || searchParams.group)
  const filterName = activeCommunity?.label ?? groups.find((g) => `${g.dimension}:${g.value}` === searchParams.group)?.label ?? 'one group'
  return (
    <div className="space-y-8">
      {confidentialSearchMode && <ConfidentialModeIndicator redesign />}
      <CommunityAutoJoinBanner notices={pendingAutoJoinNotices} />

      {unreadNotes.length > 0 && (
        <div className="space-y-3">
          {unreadNotes.map((note) => (
            <div key={note.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/60 p-5">
              <div className="max-w-xl space-y-1">
                <p className="text-base text-ink">
                  &ldquo;{note.message}&rdquo;
                  {note.revealSender && note.fromCandidate.firstName && <span className="text-muted-foreground"> from {note.fromCandidate.firstName}</span>}
                </p>
                <p className="text-sm text-muted-foreground">Someone here sent you this.</p>
              </div>
              <form action={dismissEncouragementNote.bind(null, note.id)}>
                <SubmitButton variant="outline" className="h-10 rounded-full px-5 text-sm">
                  Dismiss
                </SubmitButton>
              </form>
            </div>
          ))}
        </div>
      )}

      <Section id="post" title="Post to the community">
        <CommunityPostForm />
      </Section>

      <Section id="feed" title="From your field">
        {filterActive && (
          <p className="text-base text-ink">
            Showing posts from {filterName}.{' '}
            <Link href="/dashboard/community" className="font-medium text-brand underline underline-offset-4">
              Show everything
            </Link>
          </p>
        )}
        {posts.length === 0 && feed.length === 0 ? (
          <EmptyCard title="Nothing here yet" why="New posts and member news show up here as people share them. Check back soon, or post something yourself." />
        ) : (
          <div className="divide-y divide-border rounded-2xl border border-border">
            {mergeCommunityStream(posts, feed).map((streamItem) => (
              <CommunityStreamItem key={streamItem.kind === 'post' ? streamItem.post.id : streamItem.item.id} item={streamItem} candidateId={candidateId} />
            ))}
          </div>
        )}
      </Section>

      <ShowMore page="community" label="Filter by group, cohort, rankings and encouragement">
        {(groups.length > 0 || communities.length > 0) && (
          <Section id="filters" title="Filter by group">
            <div className="space-y-5">
              <CommunityGroupStrip groups={groups} otherParams={activeCommunity ? { community: activeCommunity.communityId } : {}} />
              <CommunityChips communities={communities} activeCommunityId={activeCommunity?.communityId} />
            </div>
          </Section>
        )}
        {cohort && (
          <Section id="cohort" title={`Your cohort: ${cohort.companyName}`}>
            <p className="max-w-xl text-base text-ink">
              Other members from the {cohort.layoffDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} layoff are posting here, so you are not going through it alone.
            </p>
            {cohort.posts.length > 0 && (
              <div className="divide-y divide-border rounded-2xl border border-border">
                {cohort.posts.slice(0, 5).map((post) => (
                  <CommunityPostCard key={post.id} post={post} isOwnPost={false} />
                ))}
              </div>
            )}
          </Section>
        )}
        <Section id="alumni" title="Groups to join">
          <AlumniNetworkOptions candidateId={candidateId} />
        </Section>
        {leaderboardTeaser && <CommunityLeaderboardModule result={leaderboardTeaser} />}
        <Section id="encouragement" title="Send encouragement">
          {encouragementGivingOptIn ? (
            <SendEncouragementForm />
          ) : (
            <p className="text-base text-ink">
              You can send a note to someone having a hard week once you turn it on.{' '}
              <Link href="/dashboard/privacy" className="font-medium text-brand underline underline-offset-4">
                Turn it on in account and privacy
              </Link>
            </p>
          )}
        </Section>
      </ShowMore>
    </div>
  )
}
