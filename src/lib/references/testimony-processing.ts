import 'server-only'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'
import type { Reference } from '@prisma/client'

// The five reference-only character traits (Prompt 48) — deliberately not
// mirrored from Working Style's 9 neutral either-direction dimensions (see
// named-reasons.ts and prisma/schema.prisma's Reference model comment for
// why). Field names on the Reference model.
const TRAIT_RATING_FIELD = {
  adaptability: 'traitAdaptabilityRating',
  followThrough: 'traitFollowThroughRating',
  presence: 'traitPresenceRating',
  collaboration: 'traitCollaborationRating',
  composure: 'traitComposureRating',
} as const

type TraitKey = keyof typeof TRAIT_RATING_FIELD

// Loose mapping from the candidate's own self-identified top strengths
// (TOP_STRENGTH_OPTIONS, onboarding Experience step) to the closest of the
// five reference traits — there's no shared underlying scale between the
// two lists, so this is a defensible best-fit, not an exact equivalence.
// "expert_in_field" and "detail_oriented" have no clean match and are left
// unmapped rather than forced.
const STRENGTH_TO_TRAIT: Partial<Record<string, TraitKey>> = {
  fast_learner: 'adaptability',
  work_ethic: 'followThrough',
  clear_communicator: 'presence',
  team_player: 'collaboration',
  people_manager: 'collaboration',
  calm_under_pressure: 'composure',
}

const CONFIRMED_THRESHOLD = 4 // 1-5 scale; 4-5 counts as the reference independently naming the trait

export interface TraitAlignment {
  strength: string
  trait: TraitKey
  confirmedByCount: number
  totalReferences: number
}

// Powers the Dossier's "Self-identified as a strength — independently
// confirmed by N of M references" callout (Prompt 47 "How I Operate" /
// Superpowers subsection).
export async function computeReferenceAlignment(candidateId: string): Promise<TraitAlignment[]> {
  const candidate = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    select: { topStrengths: true },
  })
  const completedReferences = await prisma.reference.findMany({
    where: { candidateId, status: 'COMPLETED' },
    select: {
      traitAdaptabilityRating: true,
      traitFollowThroughRating: true,
      traitPresenceRating: true,
      traitCollaborationRating: true,
      traitComposureRating: true,
    },
  })
  const totalReferences = completedReferences.length
  if (totalReferences === 0) return []

  const results: TraitAlignment[] = []
  for (const strength of candidate.topStrengths) {
    const trait = STRENGTH_TO_TRAIT[strength]
    if (!trait) continue
    const field = TRAIT_RATING_FIELD[trait]
    const confirmedByCount = completedReferences.filter((r) => (r[field] ?? 0) >= CONFIRMED_THRESHOLD).length
    if (confirmedByCount > 0) {
      results.push({ strength, trait, confirmedByCount, totalReferences })
    }
  }
  return results
}

interface DraftQuote {
  theme: string
  quoteText: string
}

// One small Anthropic call per submitted reference — clusters that
// reference's open-ended answers (superpower, under-pressure story,
// defining story) into themed, attributable pull-quote drafts. Falls back
// to no quotes (never blocks the referee's submission) if generation
// fails. Every returned quote is created with approvedByCandidateAt: null —
// the mandatory candidate-approval gate happens later, on the References
// page, never here.
export async function generateReferenceQuotes(reference: Reference): Promise<void> {
  // Only draft quotes when the reference explicitly agreed to be quoted
  // with attribution — "available on request only" answers stay as plain
  // reference data, never turned into an attributed Dossier pull-quote.
  if (!reference.quotableWithAttribution) return

  const rawAnswers = [
    reference.superpowerText && `Their superpower: ${reference.superpowerText}`,
    reference.underPressureStory && `Under pressure: ${reference.underPressureStory}`,
    reference.definingStory && `A defining story: ${reference.definingStory}`,
  ].filter((x): x is string => Boolean(x))

  if (rawAnswers.length === 0) return

  const client = getAnthropicClient()
  const prompt = `A professional reference wrote the following about someone they worked with, ${reference.refereeName} (${reference.refereeTitle ?? 'no title given'}). Turn this into 1-3 short, themed pull-quotes suitable for an executive dossier — each quote should be a real excerpt or tight paraphrase of what they actually said, not invented. Keep every specific fact and detail. Give each quote a short theme label (2-4 words, e.g. "Under pressure," "Developing people," "Raising the bar").

Respond with ONLY a JSON array, no other text: [{"theme": "...", "quoteText": "..."}]

Reference's answers:
${rawAnswers.join('\n\n')}`

  try {
    const stream = client.messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: 600,
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: prompt }],
    })
    const message = await stream.finalMessage()
    const text = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim()

    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return
    const drafts: DraftQuote[] = JSON.parse(jsonMatch[0])
    if (!Array.isArray(drafts) || drafts.length === 0) return

    await prisma.referenceQuote.createMany({
      data: drafts
        .filter((d) => d.theme && d.quoteText)
        .map((d) => ({
          candidateId: reference.candidateId,
          referenceId: reference.id,
          theme: d.theme,
          quoteText: d.quoteText,
        })),
    })
  } catch (error) {
    console.error('Failed to generate reference quotes for reference', reference.id, error)
  }
}
