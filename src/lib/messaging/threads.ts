import 'server-only'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendNewMessageNotification } from '@/lib/email/send-new-message-notification'
import { isRecruiterDatabaseUnlocked } from '@/lib/admin/recruiter-database'
import type { MessageSenderRole, ThreadPartnerType } from '@prisma/client'

// This module is the ONLY place allowed to query CandidateProfile for
// thread/inbox display — select only minimal display fields (name, avatar),
// never marketRealityReports, assessmentResponses, email, or phone. Applies
// even inside the coach portal, where dossier access is a separate,
// already-consent-gated surface (coachDossierConsentedAt) that messaging
// must not bypass. profilePictureUrl is likewise never selected anywhere
// else in this app's report/dossier generators — see the schema comment.
export const CANDIDATE_DISPLAY_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  profilePictureUrl: true,
} as const

const PARTNER_AVATAR_SELECT = { profilePictureUrl: true } as const

export function candidateDisplayName(candidate: { firstName: string | null; lastName: string | null } | null): string {
  if (!candidate) return 'Candidate'
  const name = [candidate.firstName, candidate.lastName].filter(Boolean).join(' ')
  return name || 'Candidate'
}

export function visibleAvatarUrl(person: { profilePictureUrl: string | null } | null | undefined): string | null {
  return person?.profilePictureUrl ?? null
}

type PartnerKey = { coachId?: string; recruiterId?: string; employerId?: string }

function partnerWhere(partnerType: ThreadPartnerType, partnerId: string): PartnerKey {
  if (partnerType === 'COACH') return { coachId: partnerId }
  if (partnerType === 'RECRUITER') return { recruiterId: partnerId }
  return { employerId: partnerId }
}

// Thread creation gates (privacy-critical — enforced here, not just at the
// UI call sites, since this is the one place a thread can actually be
// created):
//   - COACH: any coach-candidate pair with coachId already set may message —
//     matches the existing coach-client relationship, no extra gate needed.
//   - RECRUITER: either a SourcedCandidate for this pair has SIGNED_UP (has a
//     candidateId), OR the candidate is unlocked in the Recruiter Database
//     (opted in + most-recently-generated report grades A) — a recruiter can
//     reach out to any pool candidate they've been given visibility into,
//     not just their own sourced book.
//   - EMPLOYER: only once an ApprovedEmployer row exists for this pair (the
//     candidate-controlled reveal gate from approveEmployerInterest) —
//     messaging must never become a side channel to reach an unrevealed
//     candidate.
async function assertThreadAllowed(candidateId: string, partnerType: ThreadPartnerType, partnerId: string) {
  if (partnerType === 'COACH') {
    const candidate = await prisma.candidateProfile.findUnique({
      where: { id: candidateId },
      select: { coachId: true, coachDossierConsentedAt: true },
    })
    if (candidate?.coachId !== partnerId) throw new Error('This coach is not connected to this candidate.')
    // Prompt 85 — coach messaging reuses the SAME consent decision as Coach
    // Dossier access (coachDossierConsentedAt), not a second toggle. A coach
    // relationship can exist before that consent is given (matching happens
    // first), so this is a real gate, not a formality.
    if (!candidate.coachDossierConsentedAt) {
      throw new Error('Messaging opens once you consent to share your Coach Dossier with this coach.')
    }
    return
  }
  if (partnerType === 'RECRUITER') {
    const match = await prisma.sourcedCandidate.findFirst({
      where: { recruiterId: partnerId, candidateId, status: 'SIGNED_UP' },
      select: { id: true },
    })
    if (match) return
    if (await isRecruiterDatabaseUnlocked(candidateId)) return
    throw new Error('This candidate has not signed up through this recruiter yet.')
  }
  const approved = await prisma.approvedEmployer.findUnique({
    where: { candidateId_employerId: { candidateId, employerId: partnerId } },
  })
  if (!approved) throw new Error('This candidate has not been revealed to this employer yet.')
}

export async function getOrCreateThread(candidateId: string, partnerType: ThreadPartnerType, partnerId: string) {
  const where = partnerWhere(partnerType, partnerId)
  const existing = await prisma.messageThread.findFirst({ where: { candidateId, ...where } })
  if (existing) return existing

  await assertThreadAllowed(candidateId, partnerType, partnerId)

  return prisma.messageThread.create({
    data: { candidateId, partnerType, ...where },
  })
}

// Notifies the recipient that a message arrived — never the body content,
// never a reply-to shortcut around the app (see module header). Failures
// here must never break message sending itself.
async function notifyNewMessage(threadId: string, senderRole: MessageSenderRole) {
  try {
    const thread = await prisma.messageThread.findUnique({
      where: { id: threadId },
      include: {
        candidate: { select: { userId: true, firstName: true, lastName: true } },
        coach: { select: { userId: true, fullName: true } },
        recruiter: { select: { userId: true, fullName: true } },
        employer: { select: { userId: true, contactName: true, companyName: true } },
      },
    })
    // This helper only ever fires for COACH/RECRUITER/EMPLOYER threads (see
    // sendMessage's callers) — PEER threads use notifyNewPeerMessage instead
    // — so candidate is always present here despite the nullable column.
    if (!thread || !thread.candidate) return

    const senderName =
      senderRole === 'CANDIDATE'
        ? candidateDisplayName(thread.candidate)
        : senderRole === 'COACH'
          ? (thread.coach?.fullName ?? 'Your coach')
          : senderRole === 'RECRUITER'
            ? (thread.recruiter?.fullName ?? 'Your recruiter')
            : (thread.employer?.contactName ?? thread.employer?.companyName ?? 'An employer')

    let recipientUserId: string | null
    let recipientFirstName: string | null
    let threadPath: string

    if (senderRole === 'CANDIDATE') {
      if (thread.partnerType === 'COACH') {
        recipientUserId = thread.coach?.userId ?? null
        recipientFirstName = thread.coach?.fullName?.split(' ')[0] ?? null
        threadPath = `/support/coach/messages/${threadId}`
      } else if (thread.partnerType === 'RECRUITER') {
        recipientUserId = thread.recruiter?.userId ?? null
        recipientFirstName = thread.recruiter?.fullName?.split(' ')[0] ?? null
        threadPath = `/recruiters/messages/${threadId}`
      } else {
        recipientUserId = thread.employer?.userId ?? null
        recipientFirstName = thread.employer?.contactName?.split(' ')[0] ?? null
        threadPath = `/talent/messages/${threadId}`
      }
    } else {
      recipientUserId = thread.candidate.userId
      recipientFirstName = thread.candidate.firstName
      threadPath = `/dashboard/community?tab=messages&thread=${threadId}`
    }

    if (!recipientUserId) return

    const admin = createAdminClient()
    const { data } = await admin.auth.admin.getUserById(recipientUserId)
    const recipientEmail = data.user?.email
    if (!recipientEmail) return

    await sendNewMessageNotification({ toEmail: recipientEmail, recipientFirstName, senderName, threadPath })
  } catch (error) {
    console.error('Failed to send new message notification:', error)
  }
}

export async function sendMessage(
  threadId: string,
  senderRole: MessageSenderRole,
  body: string,
  // Only meaningful (and only passed) for PEER threads — see Message.senderCandidateId.
  senderCandidateId?: string
) {
  const trimmed = body.trim()
  if (!trimmed) throw new Error('Message cannot be empty.')

  const [message] = await prisma.$transaction([
    prisma.message.create({ data: { threadId, senderRole, body: trimmed, senderCandidateId } }),
    prisma.messageThread.update({
      where: { id: threadId },
      data:
        senderRole === 'CANDIDATE'
          ? { lastMessageAt: new Date(), candidateLastReadAt: new Date() }
          : { lastMessageAt: new Date(), partnerLastReadAt: new Date() },
    }),
  ])

  await notifyNewMessage(threadId, senderRole)

  return message
}

export async function markThreadRead(threadId: string, side: 'candidate' | 'partner') {
  await prisma.messageThread.update({
    where: { id: threadId },
    data: side === 'candidate' ? { candidateLastReadAt: new Date() } : { partnerLastReadAt: new Date() },
  })
}

function isUnread(thread: { lastMessageAt: Date; candidateLastReadAt: Date; partnerLastReadAt: Date }, side: 'candidate' | 'partner') {
  const readAt = side === 'candidate' ? thread.candidateLastReadAt : thread.partnerLastReadAt
  return thread.lastMessageAt > readAt
}

// Prisma's query builder can't compare two columns on the same row, so
// unread counts are computed in JS over the (small, per-partner) set of
// thread rows rather than pushed down as a single WHERE clause.
async function countUnreadForPartner(where: PartnerKey): Promise<number> {
  const threads = await prisma.messageThread.findMany({
    where,
    select: { lastMessageAt: true, partnerLastReadAt: true },
  })
  return threads.filter((t) => t.lastMessageAt > t.partnerLastReadAt).length
}

// ── Candidate side ──────────────────────────────────────────────────────────

export async function getCandidateThreads(candidateId: string) {
  const threads = await prisma.messageThread.findMany({
    where: { candidateId },
    orderBy: { lastMessageAt: 'desc' },
    include: {
      coach: { select: { id: true, fullName: true, ...PARTNER_AVATAR_SELECT } },
      recruiter: { select: { id: true, fullName: true, ...PARTNER_AVATAR_SELECT } },
      employer: { select: { id: true, companyName: true, ...PARTNER_AVATAR_SELECT } },
    },
  })
  return threads.map((thread) => ({
    id: thread.id,
    partnerType: thread.partnerType,
    partnerName:
      thread.coach?.fullName ?? thread.recruiter?.fullName ?? thread.employer?.companyName ?? 'NextChapter contact',
    partnerAvatarUrl: visibleAvatarUrl(thread.coach) ?? visibleAvatarUrl(thread.recruiter) ?? visibleAvatarUrl(thread.employer),
    lastMessageAt: thread.lastMessageAt,
    unread: isUnread(thread, 'candidate'),
  }))
}

export async function getCandidateUnreadCount(candidateId: string): Promise<number> {
  const threads = await prisma.messageThread.findMany({
    where: { candidateId },
    select: { lastMessageAt: true, candidateLastReadAt: true },
  })
  return threads.filter((t) => t.lastMessageAt > t.candidateLastReadAt).length
}

// ── Coach side ───────────────────────────────────────────────────────────────

export async function getCoachThreads(coachId: string) {
  const threads = await prisma.messageThread.findMany({
    where: { coachId },
    orderBy: { lastMessageAt: 'desc' },
    include: { candidate: { select: CANDIDATE_DISPLAY_SELECT } },
  })
  return threads.map((thread) => ({
    id: thread.id,
    candidateId: thread.candidateId,
    candidateName: candidateDisplayName(thread.candidate),
    candidateAvatarUrl: visibleAvatarUrl(thread.candidate),
    lastMessageAt: thread.lastMessageAt,
    unread: isUnread(thread, 'partner'),
  }))
}

export async function getCoachUnreadCount(coachId: string): Promise<number> {
  return countUnreadForPartner({ coachId })
}

// ── Recruiter side ───────────────────────────────────────────────────────────

export async function getRecruiterThreads(recruiterId: string) {
  const threads = await prisma.messageThread.findMany({
    where: { recruiterId },
    orderBy: { lastMessageAt: 'desc' },
    include: { candidate: { select: CANDIDATE_DISPLAY_SELECT } },
  })
  return threads.map((thread) => ({
    id: thread.id,
    candidateId: thread.candidateId,
    candidateName: candidateDisplayName(thread.candidate),
    candidateAvatarUrl: visibleAvatarUrl(thread.candidate),
    lastMessageAt: thread.lastMessageAt,
    unread: isUnread(thread, 'partner'),
  }))
}

export async function getRecruiterUnreadCount(recruiterId: string): Promise<number> {
  return countUnreadForPartner({ recruiterId })
}

// ── Employer side ────────────────────────────────────────────────────────────

export async function getEmployerThreads(employerId: string) {
  const threads = await prisma.messageThread.findMany({
    where: { employerId },
    orderBy: { lastMessageAt: 'desc' },
    include: { candidate: { select: CANDIDATE_DISPLAY_SELECT } },
  })
  return threads.map((thread) => ({
    id: thread.id,
    candidateId: thread.candidateId,
    candidateName: candidateDisplayName(thread.candidate),
    candidateAvatarUrl: visibleAvatarUrl(thread.candidate),
    lastMessageAt: thread.lastMessageAt,
    unread: isUnread(thread, 'partner'),
  }))
}

export async function getEmployerUnreadCount(employerId: string): Promise<number> {
  return countUnreadForPartner({ employerId })
}

// ── Shared thread detail (both sides use this, guarded by caller's own
// ownership check on candidateId/coachId/recruiterId/employerId) ───────────

// ── Candidate-initiated contact (Recruiters/Hiring Managers messaging tabs)
// ────────────────────────────────────────────────────────────────────────
// Candidate-initiated contact never existed before this — getOrCreateThread
// was only ever called from the recruiter/employer side. These two queries
// deliberately use only relationships that already exist elsewhere in the
// app (a signup through a specific recruiter, an employer reveal) rather
// than exposing a new browse-any-recruiter surface — assertThreadAllowed's
// existing RECRUITER/EMPLOYER branches already permit exactly these pairs.

export async function getCandidateEligibleRecruiters(candidateId: string) {
  const sourced = await prisma.sourcedCandidate.findMany({
    where: { candidateId, status: 'SIGNED_UP' },
    select: { recruiter: { select: { id: true, fullName: true, ...PARTNER_AVATAR_SELECT } } },
  })
  const existingThreads = await prisma.messageThread.findMany({
    where: { candidateId, partnerType: 'RECRUITER' },
    select: { recruiterId: true },
  })
  const alreadyThreaded = new Set(existingThreads.map((t) => t.recruiterId))
  const seen = new Set<string>()
  return sourced
    .map((s) => s.recruiter)
    .filter((r): r is NonNullable<typeof r> => !!r && !alreadyThreaded.has(r.id))
    .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
}

export async function getCandidateEligibleEmployers(candidateId: string) {
  const approved = await prisma.approvedEmployer.findMany({
    where: { candidateId },
    select: { employer: { select: { id: true, companyName: true, ...PARTNER_AVATAR_SELECT } } },
  })
  const existingThreads = await prisma.messageThread.findMany({
    where: { candidateId, partnerType: 'EMPLOYER' },
    select: { employerId: true },
  })
  const alreadyThreaded = new Set(existingThreads.map((t) => t.employerId))
  return approved.map((a) => a.employer).filter((e) => !alreadyThreaded.has(e.id))
}

export async function getThreadWithMessages(threadId: string) {
  const thread = await prisma.messageThread.findUnique({
    where: { id: threadId },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      candidate: { select: CANDIDATE_DISPLAY_SELECT },
      coach: { select: { id: true, fullName: true, ...PARTNER_AVATAR_SELECT } },
      recruiter: { select: { id: true, fullName: true, ...PARTNER_AVATAR_SELECT } },
      employer: { select: { id: true, companyName: true, ...PARTNER_AVATAR_SELECT } },
    },
  })
  if (!thread) return null

  return {
    ...thread,
    candidateAvatarUrl: visibleAvatarUrl(thread.candidate),
    partnerAvatarUrl: visibleAvatarUrl(thread.coach) ?? visibleAvatarUrl(thread.recruiter) ?? visibleAvatarUrl(thread.employer),
  }
}
