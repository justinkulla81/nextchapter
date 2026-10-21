import 'server-only'
import type { CandidateProfile, CommunityModerationCategory, CommunityModerationStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { classifyCommunityPost, moderationOutcome, type ModerationOutcome } from '@/lib/community/moderation'
import type { KnownIdentifiers } from './leak'
import { canSeeQuestion, type Viewer } from './eligibility'
import type { WorkQuestionView } from './constants'

const LIST_LIMIT = 20

/** Current employers, normalized. Used both to hide a question from coworkers and to decide who is a coworker. */
export async function currentCompanies(candidateId: string): Promise<string[]> {
  const rows = await prisma.workHistoryEntry.findMany({
    where: { candidateId, OR: [{ isCurrent: true }, { endDate: null }] },
    select: { companyName: true, companyNameNormalized: true },
  })
  return [...new Set(rows.map((r) => r.companyNameNormalized || normalizeOrgName(r.companyName)).filter(Boolean))]
}

export async function seniorityBandOf(candidateId: string): Promise<string | null> {
  const row = await prisma.resumeAnalysis.findFirst({ where: { candidateId }, orderBy: { createdAt: 'desc' }, select: { seniorityBand: true } })
  return row?.seniorityBand ?? null
}

export async function viewerFor(profile: Pick<CandidateProfile, 'id'>): Promise<Viewer> {
  const [seniorityBand, companies] = await Promise.all([seniorityBandOf(profile.id), currentCompanies(profile.id)])
  return { id: profile.id, seniorityBand, companies }
}

/** Everything we know that would identify the member: their name, every employer they have listed, and their city. */
export async function knownIdentifiers(profile: Pick<CandidateProfile, 'id' | 'firstName' | 'lastName' | 'currentCity'>): Promise<KnownIdentifiers> {
  const jobs = await prisma.workHistoryEntry.findMany({ where: { candidateId: profile.id }, select: { companyName: true } })
  return {
    names: [profile.firstName, profile.lastName].filter((n): n is string => !!n),
    companies: [...new Set(jobs.map((j) => j.companyName).filter(Boolean))],
    places: profile.currentCity ? [profile.currentCity] : [],
  }
}

export interface Moderated {
  status: CommunityModerationStatus
  category: CommunityModerationCategory | null
  confidence: number | null
  reasoning: string
  outcome: ModerationOutcome
}

// Same classifier and same fail-closed rule as the community feed: if it cannot run, the text is held, never published.
export async function moderateText(text: string): Promise<Moderated> {
  try {
    const c = await classifyCommunityPost(text)
    const outcome = moderationOutcome(c.category)
    const status: CommunityModerationStatus = outcome === 'HOLD' ? 'HELD' : outcome === 'REMOVE' ? 'REMOVED' : 'PUBLISHED'
    return { status, category: c.category, confidence: c.confidenceScore, reasoning: c.reasoning, outcome }
  } catch (error) {
    console.error('Work help moderation failed:', error instanceof Error ? error.message : 'unknown error')
    return { status: 'HELD', category: null, confidence: null, reasoning: 'Automated classification failed, held for manual review.', outcome: 'HOLD' }
  }
}

const iso = (d: Date) => d.toISOString()

/** The member's own questions, with the replies that cleared moderation. */
export async function listMine(candidateId: string): Promise<WorkQuestionView[]> {
  const rows = await prisma.workQuestion.findMany({
    where: { candidateId, isActive: true, moderationStatus: { in: ['PUBLISHED', 'HELD'] } },
    orderBy: { createdAt: 'desc' },
    take: LIST_LIMIT,
    include: { replies: { where: { isActive: true, moderationStatus: 'PUBLISHED' }, orderBy: { createdAt: 'asc' } } },
  })
  return rows.map((q) => ({
    id: q.id,
    handle: q.handle,
    title: q.title,
    body: q.body,
    createdAt: iso(q.createdAt),
    status: q.moderationStatus === 'HELD' ? 'HELD' : 'PUBLISHED',
    replies: q.replies.map((r) => ({ id: r.id, handle: r.handle, body: r.body, createdAt: iso(r.createdAt), mine: false })),
  }))
}

/** Questions the member may answer: people at their level, at other companies, never their own. */
export async function listForMe(viewer: Viewer): Promise<WorkQuestionView[]> {
  const rows = await prisma.workQuestion.findMany({
    where: {
      isActive: true,
      moderationStatus: 'PUBLISHED',
      candidateId: { not: viewer.id },
      ...(viewer.seniorityBand ? { OR: [{ seniorityBand: null }, { seniorityBand: viewer.seniorityBand }] } : { seniorityBand: null }),
      ...(viewer.companies.length > 0 ? { NOT: { excludedCompanies: { hasSome: viewer.companies } } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: LIST_LIMIT * 2,
    include: { replies: { where: { isActive: true, moderationStatus: 'PUBLISHED' }, orderBy: { createdAt: 'asc' } } },
  })
  return rows
    .filter((q) => canSeeQuestion(viewer, q))
    .slice(0, LIST_LIMIT)
    .map((q) => ({
      id: q.id,
      handle: q.handle,
      title: q.title,
      body: q.body,
      createdAt: iso(q.createdAt),
      status: 'PUBLISHED' as const,
      replies: q.replies.map((r) => ({ id: r.id, handle: r.handle, body: r.body, createdAt: iso(r.createdAt), mine: r.candidateId === viewer.id })),
    }))
}

export function isMissingTable(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code
  const message = err instanceof Error ? err.message : ''
  return code === 'P2021' || code === 'P2022' || /does not exist/i.test(message)
}

export interface AdminWorkItem {
  type: 'question' | 'reply'
  id: string
  /** The real identity trail, for moderation only. Never shown to other members. Same rule as getReportedCommunityPosts. */
  authorName: string
  title: string | null
  body: string
  /** For a reply: the question it answers. */
  questionTitle: string | null
  held: boolean
  moderationCategory: CommunityModerationCategory | null
  reportedAt: Date | null
  reportReason: string | null
  createdAt: Date
}

// Admin-only. Reported items, plus anything the classifier held. Held work questions and replies are invisible to
// everyone but the author, so without this list they would never be reviewed.
export async function getWorkItemsForReview(): Promise<AdminWorkItem[]> {
  const where = { OR: [{ reportedAt: { not: null } }, { moderationStatus: 'HELD' as const }] }
  const author = { select: { firstName: true, lastName: true } }
  const [questions, replies] = await Promise.all([
    prisma.workQuestion.findMany({ where, orderBy: { createdAt: 'asc' }, include: { candidate: author } }),
    prisma.workQuestionReply.findMany({ where, orderBy: { createdAt: 'asc' }, include: { candidate: author, question: { select: { title: true } } } }),
  ])
  const name = (c: { firstName: string | null; lastName: string | null }) => [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Candidate'
  return [
    ...questions.map((q) => ({
      type: 'question' as const,
      id: q.id,
      authorName: name(q.candidate),
      title: q.title,
      body: q.body,
      questionTitle: null,
      held: q.moderationStatus === 'HELD',
      moderationCategory: q.moderationCategory,
      reportedAt: q.reportedAt,
      reportReason: q.reportReason,
      createdAt: q.createdAt,
    })),
    ...replies.map((r) => ({
      type: 'reply' as const,
      id: r.id,
      authorName: name(r.candidate),
      title: null,
      body: r.body,
      questionTitle: r.question.title,
      held: r.moderationStatus === 'HELD',
      moderationCategory: r.moderationCategory,
      reportedAt: r.reportedAt,
      reportReason: r.reportReason,
      createdAt: r.createdAt,
    })),
  ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
}

export async function countWorkItemsForReview(): Promise<number> {
  const where = { OR: [{ reportedAt: { not: null } }, { moderationStatus: 'HELD' as const }] }
  try {
    const [q, r] = await Promise.all([prisma.workQuestion.count({ where }), prisma.workQuestionReply.count({ where })])
    return q + r
  } catch (err) {
    if (isMissingTable(err)) return 0
    throw err
  }
}
