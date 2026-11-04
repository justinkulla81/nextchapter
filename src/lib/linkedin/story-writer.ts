import 'server-only'
import { getAnthropicClient } from '@/lib/anthropic'
import { captureServerEvent } from '@/lib/posthog/server'
import { reserveWriterCall } from '@/lib/social/writer'
import type { Fact } from '@/lib/social/facts'
import { checkStory, MAX_STORY_CHARS } from './story-rules'

const MODEL = process.env.SOCIAL_WRITER_MODEL ?? 'claude-sonnet-5'

const SYSTEM = `You write one LinkedIn post for NextChapter's company page. NextChapter publishes free layoff, hiring, skills and pay data for the white-collar job market. The readers are HR and talent leaders, recruiters, career coaches, workforce-development professionals, economists and people between jobs.

Voice: a knowledgeable colleague. Plain, confident and specific. Never hype, never a brand announcement.

Shape, all of it:
- Line 1 is the point on its own, under 140 characters, no emoji. It must make a professional stop scrolling because it says something concrete.
- Then a blank line, then two to four short paragraphs of one or two sentences, with a blank line between them. Each paragraph carries one idea. Say what the figure means for the reader's work, using only the facts.
- Then one closing line that asks a specific question or invites a specific contribution (for example what the reader is seeing in their market, or what they would add). Vary it; do not always ask the same thing.
- The last line is exactly three hashtags and nothing else. No other hashtags anywhere.
- Between 500 and 1,100 characters in all.

Rules, all of them:
- Use only the facts you are given. Copy every number exactly as written, in digits. Never add a number, a cause, a prediction, advice or an opinion the facts do not state. Keep any caveat the facts ask you to keep.
- No web addresses (the link goes in a comment), no emojis, no dashes (use a comma or a full stop), no exclamation marks, no stock phrases such as "excited to share", "game changer", "here's the thing" or "let's dive in".
- Begin differently from the recent posts you are shown: different first words and a different shape. Do not reuse their phrasing.
- Reply with the post text only.`

const TONE: Record<string, string> = {
  ranking: 'A list finding. Curious and useful.',
  skill: 'A hiring finding about a skill. Say what it means for people who hire or train for it.',
  'ai-pay': 'A pay finding about AI skills. Careful: it compares advertised pay, so keep the caveat in plain words.',
  help: 'Practical help for people who lost a job and for the people who support them. Warm and plain, no promises.',
  press: 'A research finding that reporters and economists may quote. Neutral and precise, name the source in plain words.',
}

export type StoryDraftText = { ok: true; body: string } | { ok: false; reason: string }

/** Writes the LinkedIn post for one fact. One retry with the reason a draft was rejected; never throws; counts against the writer's daily cap. */
export async function writeLinkedInStory(fact: Fact, recent: string[]): Promise<StoryDraftText> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, reason: 'no api key' }
  let rejected: string | null = null
  for (let attempt = 1; attempt <= 2; attempt++) {
    if (!(await reserveWriterCall())) return { ok: false, reason: 'daily cap' }
    try {
      const res = await getAnthropicClient().messages.create({
        model: MODEL,
        max_tokens: Math.ceil(MAX_STORY_CHARS / 2),
        system: SYSTEM,
        messages: [{
          role: 'user',
          content:
            `${TONE[fact.topic] ?? ''}\n\nFacts:\n${fact.lines.map((l) => `- ${l}`).join('\n')}\n\n` +
            (recent.length ? `Recent LinkedIn posts from this page (do not echo their opening or phrasing):\n${recent.map((r, i) => `${i + 1}. ${r.split('\n')[0]}`).join('\n')}\n\n` : '') +
            (rejected ? `Your last draft was rejected: ${rejected}. Write a new one that fixes it.\n\n` : '') +
            'Write the post now.',
        }],
      })
      const body = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('').trim().replace(/^["“]|["”]$/g, '').trim()
      const check = checkStory(body, fact.lines)
      if (check.ok) return { ok: true, body }
      rejected = check.reason
      captureServerEvent('cron', 'linkedin_story_draft_rejected', { factKey: fact.key, topic: fact.topic, attempt, reason: check.reason })
    } catch (e) {
      captureServerEvent('cron', 'linkedin_story_draft_failed', { factKey: fact.key, topic: fact.topic, attempt, error: e instanceof Error ? e.message : String(e) })
      return { ok: false, reason: 'model error' }
    }
  }
  return { ok: false, reason: rejected ?? 'rejected' }
}
