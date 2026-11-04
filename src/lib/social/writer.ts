import 'server-only'
import { getAnthropicClient } from '@/lib/anthropic'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import type { Fact } from '@/lib/social/facts'
import { checkDraft, LINK_TOKEN } from '@/lib/social/validate'

const MODEL = process.env.SOCIAL_WRITER_MODEL ?? 'claude-sonnet-5'
/** Two channels, each post drafted separately, up to two tries each. */
const DEFAULT_DAILY_CALLS = 250

const SYSTEM = `You write one short post for NextChapter's account on Bluesky. NextChapter publishes free employment data: layoffs, hiring, skills and pay.

Write like a thoughtful person who follows the job market, not like a brand. Plain words, one idea, one to three sentences, under 200 characters before the link.

Rules, all of them:
- Use only the facts you are given. Copy every number exactly as written in the facts, in digits. Never add a number, a cause, a prediction, advice or an opinion the facts do not state.
- Say who reported a layoff the way the facts say it, and keep any caveat the facts ask you to keep.
- Never say what has or has not been reported, confirmed, disclosed or detailed, and never remark on missing information ("no further detail", "not yet clear") or on the figure itself ("that's the figure as reported", "as reported"). Say only what the facts say.
- No hashtags, emojis, exclamation marks, dashes (use a comma or a full stop), questions aimed at the reader, or stock phrases such as "exciting news", "here's the thing", "let's dive in", "breaking" or "game changer".
- Begin differently from the recent posts you are shown: different first words and a different sentence shape. Do not reuse their phrasing.
- Put ${LINK_TOKEN} exactly once, at the end, alone or after a short lead-in. Never write a web address yourself.
- Reply with the post text only.`

const TONE: Record<Fact['topic'], string> = {
  layoff: 'This is about people losing jobs. State plainly what was reported and by whom, with care. No cheer, no jokes, no speculation about why.',
  ranking: 'A list finding. Curious and useful, a little conversational.',
  'ai-pay': 'A pay finding about AI skills. Careful: it compares advertised pay, so keep the caveat short but present.',
  skill: 'A hiring finding about a skill. Curious and useful, a little conversational.',
  help: 'Practical help for someone who just lost a job. Warm and plain, no cheer, no promises. Say what the state pays and who decides, then point to the page.',
  press: 'A research finding that reporters and economists may quote. Neutral and precise, no hype, name the source in plain words and keep every figure exactly as given.',
  roundup: 'A summary of totals. Plain and factual.',
}

const CHANNEL_VOICE: Record<string, string> = {
  bluesky: 'This one is for Bluesky: conversational, with room to explain, two or three sentences.',
  x: 'This one is for X: tighter and punchier, one or two short sentences, lead with the most striking figure.',
}

const positiveInt = (v: string | undefined, fallback: number) => {
  const n = Number.parseInt(v ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/** One call, counted per UTC day in ApiUsageCounter. Fails closed: a counter problem means the plain template, never an open tap. */
export async function reserveWriterCall(): Promise<boolean> {
  try {
    const period = new Date().toISOString().slice(0, 10)
    const row = await prisma.apiUsageCounter.upsert({
      where: { service_period: { service: 'social-writer-day', period } },
      create: { service: 'social-writer-day', period, count: 1 },
      update: { count: { increment: 1 } },
      select: { count: true },
    })
    return row.count <= positiveInt(process.env.SOCIAL_WRITER_DAILY_CALLS, DEFAULT_DAILY_CALLS)
  } catch {
    return false
  }
}

export type Draft = { by: 'claude'; body: string } | { by: 'template'; body: null; reason: string }

/**
 * Writes the post for one fact in a person's voice, for one channel (each channel gets its own draft, so the same layoff reads
 * differently on Bluesky and X). `recent` is the last posts on that channel, so this one opens differently.
 * A draft that breaks a rule (a number that is not in the facts, too long, no link) is sent back once with the reason; if the second
 * draft fails too, or the writer is off or over its daily cap, the caller uses the fact's plain template. Never throws.
 */
export async function writePost(fact: Fact, recent: string[], channel: string): Promise<Draft> {
  if (!process.env.ANTHROPIC_API_KEY) return { by: 'template', body: null, reason: 'no api key' }
  let rejected: string | null = null
  for (let attempt = 1; attempt <= 2; attempt++) {
    if (!(await reserveWriterCall())) return { by: 'template', body: null, reason: 'daily cap' }
    try {
      const res = await getAnthropicClient().messages.create({
        model: MODEL,
        max_tokens: 300,
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content:
              `${TONE[fact.topic]}${CHANNEL_VOICE[channel] ? ` ${CHANNEL_VOICE[channel]}` : ''}\n\nFacts:\n${fact.lines.map((l) => `- ${l}`).join('\n')}\n\n` +
              (recent.length ? `Recent posts from this account (do not echo their opening or phrasing):\n${recent.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n\n` : '') +
              (rejected ? `Your last draft was rejected: ${rejected}. Write a new one that fixes it.\n\n` : '') +
              'Write the post now.',
          },
        ],
      })
      const body = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('').trim().replace(/^["“]|["”]$/g, '').trim()
      const check = checkDraft(body, fact)
      if (check.ok) return { by: 'claude', body }
      rejected = check.reason
      captureServerEvent('cron', 'social_draft_rejected', { factKey: fact.key, topic: fact.topic, attempt, reason: check.reason })
    } catch (e) {
      captureServerEvent('cron', 'social_draft_failed', { factKey: fact.key, topic: fact.topic, attempt, error: e instanceof Error ? e.message : String(e) })
      return { by: 'template', body: null, reason: 'model error' }
    }
  }
  return { by: 'template', body: null, reason: rejected ?? 'rejected' }
}
