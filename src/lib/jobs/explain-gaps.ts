import 'server-only'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'
import { MATCH_DIMENSION_LABEL, MATCH_DIMENSION_ORDER, MATCH_STATUS_LABEL, type JobMatch } from '@/lib/jobs/job-match-types'

/**
 * "Explain my gaps": a short write-up of one job's match and gaps, drafted on a
 * member's click. Metered cost, approved by the owner 2026-10-14; still gated by
 * JOB_GAPS_EXPLAIN_ENABLED=true.
 *
 * Cost per new write-up (Claude Haiku 5.5, $0.10 / $0.50 per million tokens in / out):
 * ~1,500 input tokens and ~700 output tokens ≈ $0.0005 per click; 50 members × 5
 * clicks a day ≈ $4/month at most. Each write-up is stored once per member and job
 * (JobGapExplanation), so a repeat click is free, and the daily cap counts those rows.
 */

export const EXPLAIN_GAPS_DAILY_LIMIT = 10
const MODEL = 'claude-haiku-5-5'

export function isExplainGapsEnabled(): boolean {
  return process.env.JOB_GAPS_EXPLAIN_ENABLED === 'true'
}

export type ExplainGapsResult = { ok: true; body: string; reused: boolean } | { ok: false; error: string }

/** The prompt, built only from the rules-based match and what the card already shows. Pure — tested. */
export function buildExplainGapsPrompt(input: {
  title: string
  company: string | null
  excerpt: string | null
  match: JobMatch
  /** Skills the member's own applications keep asking for that they don't list (src/lib/applications), most repeated first. */
  applicationGaps?: { term: string; applications: number }[]
}): string {
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
${input.match.gaps.map((g) => `- ${g}`).join('\n') || '- none'}

Skills the jobs they already applied to keep asking for that their profile does not show (mention one only if this job asks for it too):
${(input.applicationGaps ?? []).map((g) => `- ${g.term} (${g.applications} applications)`).join('\n') || '- none recorded'}

Hard requirements the posting states (a "red flag" is one the job seeker told us they don't meet — say so plainly first, and don't suggest working around a legal requirement):
${(input.match.requirements ?? []).map((r) => `- ${r.status === 'blocker' ? 'RED FLAG: ' : r.status === 'unknown' ? 'Not answered yet: ' : ''}${r.message}`).join('\n') || '- none'}`
}

export async function explainGaps(
  candidateId: string,
  postingId: string,
  input: Parameters<typeof buildExplainGapsPrompt>[0]
): Promise<ExplainGapsResult> {
  if (!isExplainGapsEnabled()) return { ok: false, error: 'This feature is not available yet.' }
  const hit = await prisma.jobGapExplanation.findUnique({
    where: { candidateId_postingId: { candidateId, postingId } },
    select: { body: true },
  })
  if (hit) return { ok: true, body: hit.body, reused: true }

  const used = await prisma.jobGapExplanation.count({
    where: { candidateId, createdAt: { gt: new Date(Date.now() - 86_400_000) } },
  })
  if (used >= EXPLAIN_GAPS_DAILY_LIMIT) {
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
    // Two quick clicks can race; the unique key keeps one row either way.
    await prisma.jobGapExplanation.upsert({
      where: { candidateId_postingId: { candidateId, postingId } },
      create: { candidateId, postingId, body },
      update: {},
    })
    return { ok: true, body, reused: false }
  } catch {
    return { ok: false, error: "We couldn't write an explanation right now. Try again in a moment." }
  }
}
