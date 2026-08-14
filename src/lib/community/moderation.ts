import 'server-only'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { CommunityModerationCategory } from '@prisma/client'
import { getAnthropicClient } from '@/lib/anthropic'
import { prisma } from '@/lib/prisma'
import { anonymize } from '@/lib/community/community-feed'

// Master Build Script §14 — AI moderation on every post, human escalation.
// Same structured-classification shape as src/lib/research/classify.ts
// (Anthropic call + zodOutputFormat + confidence score + needs-review flag),
// new prompt/schema for the 7 moderation categories below.

const CONFIDENCE_THRESHOLD = 0.6

const moderationSchema = z.object({
  category: z
    .enum([
      'RECRUITMENT_FRAUD',
      'CRISIS_SELF_HARM',
      'HARASSMENT_ABUSE',
      'DOXXING_PII',
      'DEFAMATION',
      'SPAM_PROMOTION',
      'BAD_LEGAL_FINANCIAL_ADVICE',
    ])
    .nullable(),
  confidenceScore: z.number().min(0).max(1),
  reasoning: z.string(), // one sentence, shown to the human moderator — never shown to other candidates
})

export type ModerationClassification = z.infer<typeof moderationSchema> & { needsReview: boolean }

const PROMPT = `You are moderating a post for NextChapter's Community feed — a space for job-transition
candidates (laid-off, pivoting, returning after leave) to post updates, ask for help, and share leads
with peers at the same seniority level. Job seekers here are financially and emotionally stressed,
which makes them a prime target for recruitment scams and a group at real risk of crisis signals in
their writing.

Classify the post into exactly one of these categories, or null if none applies:

- RECRUITMENT_FRAUD: advance-fee scams, fake recruiters, resume-fee schemes, MLM/pyramid recruiting
  pitches disguised as job opportunities.
- CRISIS_SELF_HARM: any signal of self-harm, suicidal ideation, or acute crisis — err toward flagging
  even mild or ambiguous signals. Never require certainty.
- HARASSMENT_ABUSE: harassment, abuse, or discriminatory language directed at a person or group.
- DOXXING_PII: posts personal contact information, home address, or other identifying information
  about a third party without consent.
- DEFAMATION: an unverified, specific accusation against a NAMED individual (not a company). Ordinary
  criticism of an employer, manager's decision, or company practice is NOT defamation — that's
  legitimate venting about an employer, which this platform explicitly allows.
- SPAM_PROMOTION: spam, off-topic promotion, or unrelated advertising with no connection to a job
  search.
- BAD_LEGAL_FINANCIAL_ADVICE: the post gives specific legal or financial advice (e.g. how to handle a
  severance negotiation, unemployment benefits, or tax treatment) that should come from a qualified
  professional, not a peer's guess.

Give a confidenceScore from 0 to 1 — be honest, not falsely confident. For CRISIS_SELF_HARM
specifically, bias toward flagging over a high confidence bar — the cost of a false positive here
(a human reviewer reads a post that turns out to be fine) is far lower than a false negative.

Write one sentence of reasoning a human moderator will read to decide what to do next. Never quote
more than a few words of the post back — summarize instead.`

// Crisis/self-harm scope decision, documented here per the build spec: this
// classifier DOES run automated crisis-signal detection on Community post
// content. That is a deliberate departure from the boundary set in
// docs/specs/NextChapter_Flow_and_Narrative.md and
// docs/specs/NextChapter_Intake_Triage.md, both of which establish
// "candidate-initiated, no automated detection" for the *private*
// onboarding/intake emotional-state questions. That boundary exists so a
// candidate's private self-report about how they're doing is never
// surveilled or acted on without them choosing to surface it — the whole
// point is that opening up there is safe and consequence-free.
//
// A Community post is different in kind, not just degree: it's public
// content the candidate is choosing to publish to every other candidate in
// the feed, and every other category in this file's table already runs
// automated classification against that same content (fraud, harassment,
// doxxing, spam). Exempting crisis signals specifically from a pipeline
// that's already reading every post for other reasons wouldn't preserve any
// privacy the intake boundary is protecting — it would just mean a
// self-harm signal in a *public* post goes unnoticed while everything else
// gets caught. So: real detection here, routed to human review, Support
// During Transition surfaced to the poster — never auto-deleted, per §14
// and rule #12 in §17 ("Never auto-delete a crisis signal"). This does not
// change or weaken the intake-flow boundary; that boundary is still exactly
// as strict as before for what it was actually protecting.
export async function classifyCommunityPost(text: string): Promise<ModerationClassification> {
  const client = getAnthropicClient()
  const stream = client.messages.stream({
    model: 'claude-sonnet-5',
    max_tokens: 700,
    thinking: { type: 'adaptive' },
    output_config: { format: zodOutputFormat(moderationSchema), effort: 'medium' },
    messages: [{ role: 'user', content: `${PROMPT}\n\nPost:\n${text}` }],
  })
  const message = await stream.finalMessage()
  const data = message.parsed_output

  if (!data) {
    throw new Error('Moderation classification returned no output.')
  }

  return { ...data, needsReview: data.confidenceScore < CONFIDENCE_THRESHOLD }
}

export const MODERATION_CATEGORY_LABEL: Record<CommunityModerationCategory, string> = {
  RECRUITMENT_FRAUD: 'Recruitment fraud',
  CRISIS_SELF_HARM: 'Crisis / self-harm signal',
  HARASSMENT_ABUSE: 'Harassment / abuse',
  DOXXING_PII: 'Doxxing / PII',
  DEFAMATION: 'Defamation',
  SPAM_PROMOTION: 'Spam / promotion',
  BAD_LEGAL_FINANCIAL_ADVICE: 'Bad legal / financial advice',
}

export type ModerationOutcome = 'PUBLISH' | 'PUBLISH_FLAGGED' | 'HOLD' | 'REMOVE'

// §14's category table, translated into what happens to the row. PUBLISH
// and PUBLISH_FLAGGED both leave the post visible immediately — the
// difference is only whether it's queued for human attention.
// PUBLISH_FLAGGED covers both CRISIS_SELF_HARM (never held or removed, ever
// — rule #12 in §17) and BAD_LEGAL_FINANCIAL_ADVICE (published with a
// standing note, no urgency).
const CATEGORY_OUTCOME: Record<CommunityModerationCategory, ModerationOutcome> = {
  RECRUITMENT_FRAUD: 'HOLD',
  CRISIS_SELF_HARM: 'PUBLISH_FLAGGED',
  HARASSMENT_ABUSE: 'HOLD',
  DOXXING_PII: 'REMOVE',
  DEFAMATION: 'HOLD',
  SPAM_PROMOTION: 'REMOVE',
  BAD_LEGAL_FINANCIAL_ADVICE: 'PUBLISH_FLAGGED',
}

export function moderationOutcome(category: CommunityModerationCategory | null): ModerationOutcome {
  if (!category) return 'PUBLISH'
  return CATEGORY_OUTCOME[category]
}

// Categories where a moderator's queue entry is genuinely urgent (§14: fraud
// and crisis are "highest priority"). Used only to order the admin queue —
// every HELD post and every unreviewed CRISIS_SELF_HARM post still shows up
// regardless of this ranking.
const PRIORITY_ORDER: Record<CommunityModerationCategory, number> = {
  RECRUITMENT_FRAUD: 0,
  CRISIS_SELF_HARM: 0,
  HARASSMENT_ABUSE: 1,
  DEFAMATION: 1,
  DOXXING_PII: 2,
  SPAM_PROMOTION: 2,
  BAD_LEGAL_FINANCIAL_ADVICE: 3,
}

export function moderationPriority(category: CommunityModerationCategory | null): number {
  if (!category) return 99
  return PRIORITY_ORDER[category]
}

const QUEUE_POST_SELECT = {
  id: true,
  postType: true,
  description: true,
  createdAt: true,
  candidateId: true,
  moderationStatus: true,
  moderationCategory: true,
  moderationConfidence: true,
  moderationReasoning: true,
  moderatedAt: true,
  moderationReviewedAt: true,
  moderationReviewedByEmail: true,
  candidate: { select: { firstName: true, lastName: true } },
} as const

export type ModerationQueuePost = {
  id: string
  postType: string
  description: string
  createdAt: Date
  candidateId: string
  authorName: string
  moderationStatus: string
  moderationCategory: CommunityModerationCategory | null
  moderationConfidence: number | null
  moderationReasoning: string | null
  moderatedAt: Date | null
  moderationReviewedAt: Date | null
  moderationReviewedByEmail: string | null
}

function toQueuePost(post: {
  id: string
  postType: string
  description: string
  createdAt: Date
  candidateId: string
  moderationStatus: string
  moderationCategory: CommunityModerationCategory | null
  moderationConfidence: number | null
  moderationReasoning: string | null
  moderatedAt: Date | null
  moderationReviewedAt: Date | null
  moderationReviewedByEmail: string | null
  candidate: { firstName: string | null; lastName: string | null }
}): ModerationQueuePost {
  return {
    id: post.id,
    postType: post.postType,
    description: post.description,
    createdAt: post.createdAt,
    candidateId: post.candidateId,
    authorName: anonymize(post.candidate.firstName, post.candidate.lastName) ?? 'Candidate',
    moderationStatus: post.moderationStatus,
    moderationCategory: post.moderationCategory,
    moderationConfidence: post.moderationConfidence,
    moderationReasoning: post.moderationReasoning,
    moderatedAt: post.moderatedAt,
    moderationReviewedAt: post.moderationReviewedAt,
    moderationReviewedByEmail: post.moderationReviewedByEmail,
  }
}

export interface ModerationQueue {
  // HELD posts (recruitment fraud, harassment, defamation) plus published
  // crisis posts a human hasn't looked at yet — sorted by §14's stated
  // priority (fraud and crisis first), oldest-first within a priority tier
  // so nothing urgent sits unreviewed indefinitely.
  needsReview: ModerationQueuePost[]
  // Published-but-flagged bad legal/financial advice — a standing note
  // already shows on the post itself (§14: "flag with standing note"), so
  // this is visibility for admin, not an urgent queue.
  flagged: ModerationQueuePost[]
  // Auto-removed (doxxing/spam) — shown for transparency and to catch false
  // positives, with a restore action, not because removal itself needs a
  // human's sign-off.
  recentlyRemoved: ModerationQueuePost[]
}

// The only admin surface into the AI moderation pipeline's queue — separate
// from getReportedThreads/getReportedCommunityPosts (peer-threads.ts,
// community-feed.ts), which are driven by candidate reports, not
// classification. A post can appear in both surfaces; they answer different
// questions ("what did a candidate flag" vs "what did the classifier flag").
export async function getModerationQueue(): Promise<ModerationQueue> {
  const [held, unreviewedCrisis, flagged, recentlyRemoved] = await Promise.all([
    prisma.communityPost.findMany({
      where: { moderationStatus: 'HELD' },
      select: QUEUE_POST_SELECT,
      orderBy: { createdAt: 'asc' },
    }),
    prisma.communityPost.findMany({
      where: { moderationCategory: 'CRISIS_SELF_HARM', moderationReviewedAt: null },
      select: QUEUE_POST_SELECT,
      orderBy: { createdAt: 'asc' },
    }),
    prisma.communityPost.findMany({
      where: { moderationStatus: 'PUBLISHED', moderationCategory: 'BAD_LEGAL_FINANCIAL_ADVICE' },
      select: QUEUE_POST_SELECT,
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.communityPost.findMany({
      where: { moderationStatus: 'REMOVED' },
      select: QUEUE_POST_SELECT,
      orderBy: { moderatedAt: 'desc' },
      take: 20,
    }),
  ])

  const needsReview = [...held, ...unreviewedCrisis]
    .sort((a, b) => moderationPriority(a.moderationCategory) - moderationPriority(b.moderationCategory))
    .map(toQueuePost)

  return {
    needsReview,
    flagged: flagged.map(toQueuePost),
    recentlyRemoved: recentlyRemoved.map(toQueuePost),
  }
}
