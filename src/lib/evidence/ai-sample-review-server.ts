import 'server-only'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'
import {
  REVIEW_MODEL, buildReviewPrompt, capStatus, costMicros, normalizeReview, reviewInput, reviewSchema, specFor,
  type NormalizedReview, type ReviewCheck, type ReviewVerdict, type SampleForReview,
} from '@/lib/evidence/ai-sample-review'

export type StoredReview = { id: string; sampleId: string; verdict: ReviewVerdict; checks: ReviewCheck[]; summary: string; suggestions: string[]; createdAt: Date }

const startOfMonthUtc = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))

/** One call to the model. Null when it cannot produce a usable review (refusal, partial answer, error). */
export async function callModel(sample: SampleForReview): Promise<{ review: NormalizedReview; inputTokens: number; outputTokens: number } | { error: string; inputTokens: number; outputTokens: number }> {
  const spec = specFor(sample.sampleType)
  if (!spec) return { error: 'not_ai_sample', inputTokens: 0, outputTokens: 0 }
  const { system, user } = buildReviewPrompt(spec, reviewInput(sample, spec))
  try {
    // Thinking is left at its default (adaptive) at low effort: claude-sonnet-5-5 rejects disabled thinking.
    const stream = getAnthropicClient().messages.stream({
      model: REVIEW_MODEL,
      max_tokens: 2000,
      system,
      output_config: { format: zodOutputFormat(reviewSchema(spec)), effort: 'low' },
      messages: [{ role: 'user', content: user }],
    })
    const msg = await stream.finalMessage()
    const usage = { inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens }
    if (msg.stop_reason === 'refusal') return { error: 'refusal', ...usage }
    const parsed = msg.parsed_output
    const review = parsed ? normalizeReview(parsed, spec) : null
    return review ? { review, ...usage } : { error: 'unusable', ...usage }
  } catch (error) {
    console.error('AI sample review failed', error)
    return { error: 'api_error', inputTokens: 0, outputTokens: 0 }
  }
}

export type ReviewOutcome =
  | { ok: true; review: StoredReview; remaining: number }
  | { ok: false; code: 'not_found' | 'not_ai_sample' | 'too_long' | 'weekly' | 'budget' | 'model_failed' | 'unavailable'; message: string }

/** Review one of the member's own AI work samples: checks the caps, calls the model once, stores the result. */
export async function reviewAiSample(candidateId: string, sampleId: string): Promise<ReviewOutcome> {
  const sample = await prisma.workSample.findFirst({ where: { id: sampleId, candidateId } })
  if (!sample) return { ok: false, code: 'not_found', message: 'We could not find that sample.' }
  const spec = specFor(sample.sampleType)
  if (!spec) return { ok: false, code: 'not_ai_sample', message: 'Only AI work samples can be reviewed.' }

  let recent: Date[]
  let monthSpend: number
  try {
    const [rows, sum] = await Promise.all([
      prisma.aiSampleReview.findMany({ where: { sampleId, verdict: { not: 'unusable' }, createdAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) } }, select: { createdAt: true } }),
      prisma.aiSampleReview.aggregate({ _sum: { costMicros: true }, where: { createdAt: { gte: startOfMonthUtc() } } }),
    ])
    recent = rows.map((r) => r.createdAt)
    monthSpend = sum._sum.costMicros ?? 0
  } catch (error) {
    // The table is created by hand (prisma/manual/2026-10-19-ai-sample-review.sql); until it exists, say so and spend nothing.
    console.error('AiSampleReview not readable', error)
    return { ok: false, code: 'unavailable', message: 'AI reviews are not available yet.' }
  }

  const input = reviewInput(sample, spec)
  const cap = capStatus({ chars: input.length, recent, monthSpendMicros: monthSpend })
  if (!cap.ok) return { ok: false, code: cap.code, message: cap.message }

  const result = await callModel(sample)
  // Spend is recorded even when the answer is unusable, so the budget counts every token paid for.
  if ('error' in result) {
    if (result.inputTokens + result.outputTokens > 0) {
      await prisma.aiSampleReview.create({
        data: { candidateId, sampleId, model: REVIEW_MODEL, verdict: 'unusable', checks: [] as unknown as Prisma.InputJsonValue, summary: result.error, suggestions: [], inputTokens: result.inputTokens, outputTokens: result.outputTokens, costMicros: costMicros({ input_tokens: result.inputTokens, output_tokens: result.outputTokens }) },
      }).catch(() => {})
    }
    return { ok: false, code: 'model_failed', message: 'We could not produce a review this time. Nothing was used from your weekly limit; try again in a minute.' }
  }
  const { review, inputTokens, outputTokens } = result
  const row = await prisma.aiSampleReview.create({
    data: { candidateId, sampleId, model: REVIEW_MODEL, verdict: review.verdict, checks: review.checks as unknown as Prisma.InputJsonValue, summary: review.summary, suggestions: review.suggestions, inputTokens, outputTokens, costMicros: costMicros({ input_tokens: inputTokens, output_tokens: outputTokens }) },
  })
  return { ok: true, review: { id: row.id, sampleId, verdict: review.verdict, checks: review.checks, summary: review.summary, suggestions: review.suggestions, createdAt: row.createdAt }, remaining: cap.remainingForSample - 1 }
}

/** Latest review per sample (member-visible), plus how many reviews are left this week per sample. Empty if the table is missing. */
export async function loadSampleReviews(candidateId: string, sampleIds: string[]): Promise<{ available: boolean; latest: Record<string, StoredReview>; recent: Record<string, Date[]> }> {
  if (sampleIds.length === 0) return { available: true, latest: {}, recent: {} }
  try {
    const rows = await prisma.aiSampleReview.findMany({ where: { candidateId, sampleId: { in: sampleIds }, verdict: { not: 'unusable' } }, orderBy: { createdAt: 'desc' }, take: 200 })
    const latest: Record<string, StoredReview> = {}
    const recent: Record<string, Date[]> = {}
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000
    for (const r of rows) {
      if (!latest[r.sampleId]) latest[r.sampleId] = { id: r.id, sampleId: r.sampleId, verdict: r.verdict as ReviewVerdict, checks: r.checks as unknown as ReviewCheck[], summary: r.summary, suggestions: r.suggestions, createdAt: r.createdAt }
      if (r.createdAt.getTime() >= weekAgo) (recent[r.sampleId] ??= []).push(r.createdAt)
    }
    return { available: true, latest, recent }
  } catch {
    return { available: false, latest: {}, recent: {} }
  }
}
