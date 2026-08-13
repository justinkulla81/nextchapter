import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { sendNewMessageNotification } from '@/lib/email/send-new-message-notification'
import { createAdminClient } from '@/lib/supabase/admin'
import { CANDIDATE_DISPLAY_SELECT, candidateDisplayName, visibleAvatarUrl } from './threads'

// Prompt 85 — candidate-to-candidate community DMs. Reuses MessageThread/
// Message (partnerType: 'PEER') rather than a parallel schema, but this
// module owns all the safety logic (block, report, rate limit) that the
// coach/recruiter/employer threads in threads.ts don't need, since those
// relationships are already gated by consent/visibility elsewhere.

// A starting guess, not calibrated against real usage — see the ROADMAP
// note this batch shipped with. Counts THREADS INITIATED (first message to
// someone with no prior thread), not total messages sent, so an active back-
// and-forth with people you already talk to never counts against this.
const FIRST_CONTACT_DAILY_LIMIT = 5

function sortPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a]
}

export async function isBlocked(candidateAId: string, candidateBId: string): Promise<boolean> {
  const block = await prisma.candidateBlock.findFirst({
    where: {
      OR: [
        { blockerCandidateId: candidateAId, blockedCandidateId: candidateBId },
        { blockerCandidateId: candidateBId, blockedCandidateId: candidateAId },
      ],
    },
    select: { id: true },
  })
  return !!block
}

// Candidate-controlled, immediate, no approval needed. Blocking someone
// with an existing thread doesn't delete the thread (so a report already
// filed against it still resolves against real history) — it just makes
// every future send attempt on either side fail via assertThreadAllowed
// below.
export async function blockCandidate(blockerCandidateId: string, blockedCandidateId: string): Promise<void> {
  await prisma.candidateBlock.upsert({
    where: { blockerCandidateId_blockedCandidateId: { blockerCandidateId, blockedCandidateId } },
    create: { blockerCandidateId, blockedCandidateId },
    update: {},
  })
}

// Only the blocker can lift their own block — the blocked party has no way
// to remove it, by design (no approval flow either direction).
export async function unblockCandidate(blockerCandidateId: string, blockedCandidateId: string): Promise<void> {
  await prisma.candidateBlock
    .delete({ where: { blockerCandidateId_blockedCandidateId: { blockerCandidateId, blockedCandidateId } } })
    .catch(() => {}) // already unblocked — nothing to do
}

async function assertNotBlocked(candidateAId: string, candidateBId: string) {
  if (await isBlocked(candidateAId, candidateBId)) {
    throw new Error('You can no longer message this person.')
  }
}

function rateLimitError(): never {
  throw new Error(
    `You've started ${FIRST_CONTACT_DAILY_LIMIT} new conversations in the last 24 hours — try again tomorrow, or keep replying to conversations you've already started.`
  )
}

// Creates the thread only on first contact — replying to an existing
// thread never re-checks the rate limit or re-creates anything. The
// count-then-create for the rate limit runs inside a Serializable
// transaction (with one retry on a serialization conflict) so that several
// near-simultaneous first-contact requests from the same candidate — e.g.
// messaging 6 different people within the same second — can't all read the
// same stale count and all slip under FIRST_CONTACT_DAILY_LIMIT. A plain
// application-level count()-then-create() had exactly that race.
export async function getOrCreatePeerThread(candidateId: string, otherCandidateId: string) {
  if (candidateId === otherCandidateId) throw new Error('You cannot message yourself.')
  const [peerCandidateAId, peerCandidateBId] = sortPair(candidateId, otherCandidateId)

  const existing = await prisma.messageThread.findUnique({
    where: { peerCandidateAId_peerCandidateBId: { peerCandidateAId, peerCandidateBId } },
  })
  if (existing) return existing

  await assertNotBlocked(candidateId, otherCandidateId)

  const attempt = async () => {
    return prisma.$transaction(
      async (tx) => {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
        const count = await tx.messageThread.count({
          where: { partnerType: 'PEER', initiatedByCandidateId: candidateId, createdAt: { gte: since } },
        })
        if (count >= FIRST_CONTACT_DAILY_LIMIT) rateLimitError()

        return tx.messageThread.create({
          data: { partnerType: 'PEER', peerCandidateAId, peerCandidateBId, initiatedByCandidateId: candidateId },
        })
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )
  }

  try {
    return await attempt()
  } catch (error) {
    // P2034 = serialization/write conflict — safe to retry once. P2002 =
    // someone else already created this exact pair's thread concurrently
    // (e.g. both candidates clicked "Message" on each other at once) —
    // just return the row that won instead of erroring.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return attempt()
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const race = await prisma.messageThread.findUnique({
        where: { peerCandidateAId_peerCandidateBId: { peerCandidateAId, peerCandidateBId } },
      })
      if (race) return race
    }
    throw error
  }
}

async function notifyNewPeerMessage(threadId: string, senderCandidateId: string) {
  try {
    const thread = await prisma.messageThread.findUnique({
      where: { id: threadId },
      include: {
        peerCandidateA: { select: { userId: true, firstName: true, lastName: true } },
        peerCandidateB: { select: { userId: true, firstName: true, lastName: true } },
      },
    })
    if (!thread?.peerCandidateA || !thread.peerCandidateB) return

    const sender = thread.peerCandidateAId === senderCandidateId ? thread.peerCandidateA : thread.peerCandidateB
    const recipient = thread.peerCandidateAId === senderCandidateId ? thread.peerCandidateB : thread.peerCandidateA

    const admin = createAdminClient()
    const { data } = await admin.auth.admin.getUserById(recipient.userId)
    const recipientEmail = data.user?.email
    if (!recipientEmail) return

    await sendNewMessageNotification({
      toEmail: recipientEmail,
      recipientFirstName: recipient.firstName,
      senderName: candidateDisplayName(sender),
      threadPath: `/dashboard/community?tab=messages&thread=${threadId}`,
    })
  } catch (error) {
    console.error('Failed to send new peer message notification:', error)
  }
}

export async function sendPeerMessage(threadId: string, senderCandidateId: string, body: string) {
  const trimmed = body.trim()
  if (!trimmed) throw new Error('Message cannot be empty.')

  const thread = await prisma.messageThread.findUnique({
    where: { id: threadId },
    select: { peerCandidateAId: true, peerCandidateBId: true },
  })
  if (!thread?.peerCandidateAId || !thread.peerCandidateBId) throw new Error('Conversation not found.')
  if (senderCandidateId !== thread.peerCandidateAId && senderCandidateId !== thread.peerCandidateBId) {
    throw new Error('You are not part of this conversation.')
  }
  const otherCandidateId = senderCandidateId === thread.peerCandidateAId ? thread.peerCandidateBId : thread.peerCandidateAId
  await assertNotBlocked(senderCandidateId, otherCandidateId)

  const senderIsA = senderCandidateId === thread.peerCandidateAId

  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: { threadId, senderRole: 'CANDIDATE', body: trimmed, senderCandidateId },
    }),
    prisma.messageThread.update({
      where: { id: threadId },
      data: senderIsA
        ? { lastMessageAt: new Date(), candidateLastReadAt: new Date() }
        : { lastMessageAt: new Date(), partnerLastReadAt: new Date() },
    }),
  ])

  await notifyNewPeerMessage(threadId, senderCandidateId)

  return message
}

export async function markPeerThreadRead(threadId: string, candidateId: string) {
  const thread = await prisma.messageThread.findUnique({
    where: { id: threadId },
    select: { peerCandidateAId: true, peerCandidateBId: true },
  })
  if (!thread) return
  if (candidateId === thread.peerCandidateAId) {
    await prisma.messageThread.update({ where: { id: threadId }, data: { candidateLastReadAt: new Date() } })
  } else if (candidateId === thread.peerCandidateBId) {
    await prisma.messageThread.update({ where: { id: threadId }, data: { partnerLastReadAt: new Date() } })
  }
}

export async function getPeerThreads(candidateId: string) {
  const threads = await prisma.messageThread.findMany({
    where: { partnerType: 'PEER', OR: [{ peerCandidateAId: candidateId }, { peerCandidateBId: candidateId }] },
    orderBy: { lastMessageAt: 'desc' },
    include: {
      peerCandidateA: { select: CANDIDATE_DISPLAY_SELECT },
      peerCandidateB: { select: CANDIDATE_DISPLAY_SELECT },
    },
  })
  return threads.map((thread) => {
    const isA = thread.peerCandidateAId === candidateId
    const other = isA ? thread.peerCandidateB : thread.peerCandidateA
    const readAt = isA ? thread.candidateLastReadAt : thread.partnerLastReadAt
    return {
      id: thread.id,
      partnerCandidateId: other?.id ?? null,
      partnerName: candidateDisplayName(other ?? null),
      partnerAvatarUrl: visibleAvatarUrl(other),
      lastMessageAt: thread.lastMessageAt,
      unread: thread.lastMessageAt > readAt,
      isReported: !!thread.reportedAt,
    }
  })
}

export async function getPeerUnreadCount(candidateId: string): Promise<number> {
  const threads = await prisma.messageThread.findMany({
    where: { partnerType: 'PEER', OR: [{ peerCandidateAId: candidateId }, { peerCandidateBId: candidateId }] },
    select: { peerCandidateAId: true, lastMessageAt: true, candidateLastReadAt: true, partnerLastReadAt: true },
  })
  return threads.filter((t) => {
    const readAt = t.peerCandidateAId === candidateId ? t.candidateLastReadAt : t.partnerLastReadAt
    return t.lastMessageAt > readAt
  }).length
}

// Ownership-checked in the same call — a peer thread has no separate
// "partner portal" the way coach/recruiter/employer threads do, so there's
// no second caller to trust the way getThreadWithMessages's callers are.
export async function getPeerThreadWithMessages(threadId: string, candidateId: string) {
  const thread = await prisma.messageThread.findUnique({
    where: { id: threadId },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      peerCandidateA: { select: CANDIDATE_DISPLAY_SELECT },
      peerCandidateB: { select: CANDIDATE_DISPLAY_SELECT },
    },
  })
  if (!thread || thread.partnerType !== 'PEER') return null
  if (thread.peerCandidateAId !== candidateId && thread.peerCandidateBId !== candidateId) return null

  const isA = thread.peerCandidateAId === candidateId
  const other = isA ? thread.peerCandidateB : thread.peerCandidateA
  const blocked = other ? await isBlocked(candidateId, other.id) : false

  return {
    ...thread,
    partnerName: candidateDisplayName(other ?? null),
    partnerCandidateId: other?.id ?? null,
    partnerAvatarUrl: visibleAvatarUrl(other),
    isBlocked: blocked,
  }
}

// Flags the conversation for the narrow admin surface below — does not
// itself stop messages (block does that) and needs no approval to take
// effect: the report is recorded immediately, full stop. Generalized
// (Phase 3 of the Community/Messaging rework) to cover Coach/Recruiter/
// Employer threads too, not just PEER — the reportedAt/reportedByCandidateId/
// reportReason columns were never DB-constrained to PEER, only gated by
// application code, which is what this function now checks against either
// shape of the thread.
export async function reportMessageThread(threadId: string, reporterCandidateId: string, reason: string): Promise<void> {
  const thread = await prisma.messageThread.findUnique({
    where: { id: threadId },
    select: { candidateId: true, peerCandidateAId: true, peerCandidateBId: true },
  })
  if (!thread) return
  const isParticipant =
    thread.candidateId === reporterCandidateId ||
    thread.peerCandidateAId === reporterCandidateId ||
    thread.peerCandidateBId === reporterCandidateId
  if (!isParticipant) {
    throw new Error('You are not part of this conversation.')
  }
  await prisma.messageThread.update({
    where: { id: threadId },
    data: { reportedAt: new Date(), reportedByCandidateId: reporterCandidateId, reportReason: reason.trim() || null },
  })
}

// Admin-only — deliberately the ONLY query in this module that reads
// arbitrary threads rather than scoping to a single candidate's own
// conversations. Narrow on purpose: reported conversations only, never a
// general DM-browsing surface (same principle as Coaching Notes' access
// gating — see threads.ts's module header). Generalized (Phase 3) to cover
// every partnerType, not just PEER, since reportMessageThread now does too.
export async function getReportedThreads() {
  const threads = await prisma.messageThread.findMany({
    where: { reportedAt: { not: null } },
    orderBy: { reportedAt: 'desc' },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      candidate: { select: CANDIDATE_DISPLAY_SELECT },
      coach: { select: { fullName: true } },
      recruiter: { select: { fullName: true } },
      employer: { select: { companyName: true } },
      peerCandidateA: { select: CANDIDATE_DISPLAY_SELECT },
      peerCandidateB: { select: CANDIDATE_DISPLAY_SELECT },
    },
  })
  return threads.map((thread) => {
    const partnerLabel =
      thread.coach?.fullName ?? thread.recruiter?.fullName ?? thread.employer?.companyName ?? null
    const sideA =
      thread.partnerType === 'PEER'
        ? { id: thread.peerCandidateA?.id, name: candidateDisplayName(thread.peerCandidateA ?? null) }
        : { id: thread.candidate?.id, name: candidateDisplayName(thread.candidate ?? null) }
    const sideB =
      thread.partnerType === 'PEER'
        ? { id: thread.peerCandidateB?.id, name: candidateDisplayName(thread.peerCandidateB ?? null) }
        : { id: null, name: partnerLabel ?? thread.partnerType }
    return {
      id: thread.id,
      partnerType: thread.partnerType,
      reportedAt: thread.reportedAt,
      reportedByCandidateId: thread.reportedByCandidateId,
      reportReason: thread.reportReason,
      candidateA: sideA,
      candidateB: sideB,
      messages: thread.messages,
    }
  })
}
