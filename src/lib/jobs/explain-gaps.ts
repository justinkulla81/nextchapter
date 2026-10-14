import 'server-only'
import { getAnthropicClient } from '@/lib/anthropic'
import { MATCH_DIMENSION_LABEL, MATCH_DIMENSION_ORDER, MATCH_STATUS_LABEL, type JobMatch } from '@/lib/jobs/job-match-types'

/**
 * PHASE 2 — DESIGNED, NOT ENABLED. "Explain my gaps": a short write-up of one job's
 * match and gaps, drafted on a member's click. Metered cost, so it is OFF unless
 * JOB_GAPS_EXPLAIN_ENABLED=true and the owner has approved it.
 *
 * Cost per new write-up (Claude Haiku 5.5, $0.10 / $0.50 per million tokens in / out):
 * ~1,500 input tokens (instructions + the rules-based match + a 1,500-char job
 * excerpt) and ~700 output tokens (≤ 400 visible + low-effort thinking)
 * ≈ $0.0005 per click. 50 members × 5 clicks a day × 30 days = 7,500 clicks ≈ $4/month
 * (an upper bound — repeat clicks on the same job are served from the cache).
 *
 * Before enabling: the cache and the per-day cap below are per server instance (in
 * memory), which is fine for a trial but not a hard cap. For production, add a
 * JobGapExplanation table (candidateId, postingId, body, createdAt; unique on
 * candidateId+postingId) and swap these maps for it, the way cover-note.ts uses
 * JobCoverNote.
 */

export const EXPLAIN_GAPS_DAILY_LIMIT = 10
const MODEL = 'claude-haiku-5-5'

export function isExplainGapsEnabled(): boolean {
  return process.env.JOB_GAPS_EXPLAIN_ENABLED === 'true'
}

const cache = new Map<string, string>()
const usage = new Map<string, number[]>()

export type ExplainGapsResult = { ok: true; body: string; reused: boolean } | { ok: false; error: string }

/** The prompt, built only from the rules-based match and what the card already shows. Pure — tested. */
export function buildExplainGapsPrompt(input: { title: string; company: string | null; excerpt: string | null; match: JobMatch }): string {
  const dims = MATCH_DIMENSION_ORDER.map((k) => {
    const d = input.match.dimensions[k]
    return `- ${MATCH_DIMENSION_LABEL[k]}: ${MATCH_STATUS_LABEL[d.status]} — ${d.evidence.join('; ')}`
  }).join('\n')
  return `You are a career coach. In 120–180 words, explain to this job seeker how they match the job below and how to handle each gap in their application and interviews.

Rules:
- Use only the facts given. Never invent experience, numbers or employer details.
- Where something is "Unknown", say what to find out or add to their profile — don't guess.
- Encouraging and direct; frame gaps as what to address, never as shortcomings.
- Plain sentences, no headings, no bullet symbols.

Job: ${input.title}${input.company ? ` at ${input.company}` : ' (confidential search)'}
${input.excerpt ? `Posting excerpt: ${input.excerpt.slice(0, 1500)}` : ''}

Match by dimension:
${dims}

Gaps already identified:
${input.match.gaps.map((g) => `- ${g}`).join('\n') || '- none'}`
}

export async function explainGaps(
  candidateId: string,
  postingId: string,
  input: Parameters<typeof buildExplainGapsPrompt>[0]
): Promise<ExplainGapsResult> {
  if (!isExplainGapsEnabled()) return { ok: false, error: 'This feature is not available yet.' }
  const key = `${candidateId}:${postingId}`
  const hit = cache.get(key)
  if (hit) return { ok: true, body: hit, reused: true }

  const since = Date.now() - 86_400_000
  const recent = (usage.get(candidateId) ?? []).filter((t) => t > since)
  if (recent.length >= EXPLAIN_GAPS_DAILY_LIMIT) {
    return { ok: false, error: `You've used ${EXPLAIN_GAPS_DAILY_LIMIT} explanations in the last 24 hours. You can get more tomorrow.` }
  }

  try {
    const message = await getAnthropicClient().messages.create({
      model: MODEL,
      max_tokens: 2000,
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: buildExplainGapsPrompt(input) }],
    })
    if (message.stop_reason === 'refusal') return { ok: false, error: "We couldn't write this one. Try another job." }
    const body = message.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim()
    if (!body) return { ok: false, error: 'The explanation came back empty. Try again in a moment.' }
    cache.set(key, body)
    usage.set(candidateId, [...recent, Date.now()])
    return { ok: true, body, reused: false }
  } catch {
    return { ok: false, error: "We couldn't write an explanation right now. Try again in a moment." }
  }
}
