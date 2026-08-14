import 'server-only'
import { prisma } from '@/lib/prisma'
import { classifyCompanyIntel, intelModerationOutcome } from '@/lib/companies/intel-moderation'
import { type IntelType } from '@/lib/companies/intel-types'

// company_intel — "how to get hired here" (Prompt 3/4). Every submission
// runs moderation BEFORE it can ever be published (verification item 7:
// "Moderation runs before publish, not after") — status starts 'pending'
// and this function decides the real outcome synchronously before
// returning, same shape as classifyCommunityPost's synchronous call.
//
// INTEL_TYPES/INTEL_TYPE_LABEL/IntelType live in intel-types.ts, not here —
// this module (and everything it imports) is 'server-only', so a client
// component needing just the type/label list imports that file instead.
export { INTEL_TYPES, INTEL_TYPE_LABEL, type IntelType } from '@/lib/companies/intel-types'

export interface SubmitIntelInput {
  companyId: string
  contributorCandidateId: string
  intelType: IntelType
  body: string
  roleLevelAtTime: string | null
  recencyBucket: string | null
  isAnonymous: boolean
}

export interface SubmitIntelResult {
  ok: boolean
  error?: string
  intelId?: string
  published: boolean // whether this contribution actually earns points — see actions layer
}

export async function submitCompanyIntel(input: SubmitIntelInput): Promise<SubmitIntelResult> {
  const body = input.body.trim()
  if (body.length < 20) {
    return { ok: false, error: 'Add a bit more detail — at least a couple of sentences.', published: false }
  }

  const classification = await classifyCompanyIntel(body)
  const outcome = intelModerationOutcome(classification.category)
  const status = outcome === 'PUBLISH' ? 'published' : outcome === 'HOLD' ? 'pending' : 'removed'

  const created = await prisma.companyIntel.create({
    data: {
      companyId: input.companyId,
      contributorCandidateId: input.contributorCandidateId,
      intelType: input.intelType,
      body,
      roleLevelAtTime: input.roleLevelAtTime,
      recencyBucket: input.recencyBucket,
      isAnonymous: input.isAnonymous,
      status,
      moderationCategory: classification.category,
      moderationReasoning: classification.reasoning,
    },
  })

  return { ok: true, intelId: created.id, published: status === 'published' }
}

export interface PublishedIntel {
  id: string
  intelType: IntelType
  body: string
  roleLevelAtTime: string | null
  recencyBucket: string | null
  helpfulCount: number
  createdAt: Date
  contributorCandidateId: string
}

export async function getPublishedIntelForCompany(companyId: string): Promise<PublishedIntel[]> {
  const rows = await prisma.companyIntel.findMany({
    where: { companyId, status: 'published' },
    orderBy: [{ helpfulCount: 'desc' }, { createdAt: 'desc' }],
  })
  return rows.map((r) => ({
    id: r.id,
    intelType: r.intelType as IntelType,
    body: r.body,
    roleLevelAtTime: r.roleLevelAtTime,
    recencyBucket: r.recencyBucket,
    helpfulCount: r.helpfulCount,
    createdAt: r.createdAt,
    contributorCandidateId: r.contributorCandidateId,
  }))
}

export interface MarkHelpfulResult {
  ok: boolean
  error?: string
  contributorCandidateId?: string // caller awards points to this candidate, not the voter
  alreadyVoted?: boolean
}

export async function markIntelHelpful(intelId: string, voterCandidateId: string): Promise<MarkHelpfulResult> {
  const intel = await prisma.companyIntel.findUnique({ where: { id: intelId } })
  if (!intel || intel.status !== 'published') return { ok: false, error: 'This tip is no longer available.' }
  if (intel.contributorCandidateId === voterCandidateId) {
    return { ok: false, error: "You can't mark your own tip helpful." }
  }

  try {
    await prisma.companyIntelHelpfulVote.create({ data: { intelId, voterCandidateId } })
  } catch {
    // Unique constraint hit — already voted, no-op (no double count, no error surfaced to the UI).
    return { ok: true, alreadyVoted: true }
  }

  await prisma.companyIntel.update({ where: { id: intelId }, data: { helpfulCount: { increment: 1 } } })
  return { ok: true, contributorCandidateId: intel.contributorCandidateId, alreadyVoted: false }
}
