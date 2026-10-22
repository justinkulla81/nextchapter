import 'server-only'
import type Anthropic from '@anthropic-ai/sdk'
import { getAnthropicClient } from '@/lib/anthropic'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { gatherMeetingPrepContext } from './context'
import type { MeetingPrepContent } from './types'

export const MEETING_PREP_MODEL = 'claude-haiku-4-5-20251001'
const MAX_SEARCHES = 5
const MAX_CONTINUATIONS = 3
// The briefing is a large JSON object; 4000 tokens truncated it mid-object on news-heavy prospects.
const MAX_TOKENS = 8000

const PRODUCT = `NextChapter helps laid-off white-collar professionals land their next role: a candidate platform (job search plan, coaching, a daily job email, résumé and narrative tools, a network of coaches and recruiters) plus programs sold to institutions. Buyers and partners include workforce boards, economic-development and chamber organizations, universities and alumni offices, outplacement buyers, employers doing layoffs, and funders. The founder, Justin Kulla, is pitching them.`

const SYSTEM = `You are preparing a one-page prospect briefing for a founder walking into a pitch. ${PRODUCT}

Rules:
- Use web search to research the prospect's organization and its LOCAL area: recent layoffs and closures (especially white-collar and corporate), regional workforce and economic-development initiatives, programs, grants and funders they run or are part of, and white-collar labor-market metrics (unemployment rate, professional/business services and information-sector employment trends, job openings, major employers' headcount moves). Prefer sources from the last 12 months and say the date.
- The CRM notes below are ground truth about our relationship. Never contradict them.
- Never invent a number, name, date, program or quote. If you cannot find something, say so in "caveats" and leave that list short or empty. A thin, honest briefing beats a padded one.
- Every layoff, initiative and metric should carry a sourceUrl you actually saw in search results, or null.
- The pitch must be specific to THIS person's role and THIS area's conditions: name the local problem, then how NextChapter addresses it. Plain, confident language. No filler, no hype.
- If you cannot tell who the prospect's organization is, say that in caveats and brief on the most likely one, labeled as a guess.

When research is done, reply with ONLY one JSON object (no prose, no code fence) with exactly this shape:
{"headline": string, "whoTheyAre": string, "relationship": string[], "local": {"summary": string, "points": string[]}, "layoffs": {"summary": string, "items": [{"employer": string, "detail": string, "date": string|null, "sourceUrl": string|null}]}, "initiatives": [{"name": string, "detail": string, "sourceUrl": string|null}], "whiteCollar": [{"metric": string, "value": string, "context": string, "sourceUrl": string|null}], "pitch": {"angle": string, "howItHelps": string[], "openingLine": string, "objections": [{"objection": string, "response": string}], "ask": string}, "caveats": string[], "sources": [{"title": string, "url": string}]}`

export function parseMeetingPrep(raw: string): MeetingPrepContent | null {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const j = JSON.parse(raw.slice(start, end + 1)) as Partial<MeetingPrepContent>
    if (!j.headline || !j.pitch || !j.local || !j.layoffs) return null
    return {
      headline: j.headline, whoTheyAre: j.whoTheyAre ?? '', relationship: j.relationship ?? [],
      local: { summary: j.local.summary ?? '', points: j.local.points ?? [] },
      layoffs: { summary: j.layoffs.summary ?? '', items: j.layoffs.items ?? [] },
      initiatives: j.initiatives ?? [], whiteCollar: j.whiteCollar ?? [],
      pitch: {
        angle: j.pitch.angle ?? '', howItHelps: j.pitch.howItHelps ?? [], openingLine: j.pitch.openingLine ?? '',
        objections: j.pitch.objections ?? [], ask: j.pitch.ask ?? '',
      },
      caveats: j.caveats ?? [], sources: j.sources ?? [],
    }
  } catch {
    return null
  }
}

/** Why a reply could not be parsed, in words that say what to fix. Keeps the start of the reply so the cause is visible on the sheet row. */
export function describeParseFailure(stopReason: string | null | undefined, raw: string): string {
  const head = raw.trim().replace(/\s+/g, ' ').slice(0, 200)
  const why = stopReason === 'max_tokens'
    ? 'The model ran out of room before finishing the Meeting Prep'
    : !raw.trim()
      ? 'The model returned no text'
      : 'The model did not return a usable Meeting Prep'
  return `${why} (stop_reason=${stopReason ?? 'unknown'}${head ? `; reply began: "${head}"` : ''}).`
}

/** Research and write one Meeting Prep. This is the metered step: one Claude call with up to MAX_SEARCHES web searches, plus one cheap no-search retry if the reply can't be parsed. */
export async function buildMeetingPrepContent(personId: string, meeting: { title: string | null; at: Date | null }): Promise<MeetingPrepContent> {
  const ctx = await gatherMeetingPrepContext(personId)
  const when = meeting.at ? meeting.at.toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'full', timeStyle: 'short' }) + ' ET' : 'upcoming'
  const messages: Anthropic.MessageParam[] = [{
    role: 'user',
    content: `Pitch: ${meeting.title ?? 'meeting'} — ${when}\n\n<crm>\n${ctx.crmText}\n</crm>`,
  }]
  const tools: Anthropic.ToolUnion[] = [{ type: 'web_search_20250305', name: 'web_search', max_uses: MAX_SEARCHES }]

  const client = getAnthropicClient()
  let text = ''
  let stopReason: string | null = null
  let lastContent: Anthropic.ContentBlock[] = []
  for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
    const res = await client.messages.create({ model: MEETING_PREP_MODEL, max_tokens: MAX_TOKENS, system: SYSTEM, tools, messages })
    text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
    stopReason = res.stop_reason
    lastContent = res.content
    if (res.stop_reason !== 'pause_turn') break
    messages.push({ role: 'assistant', content: res.content })
  }
  const parsed = parseMeetingPrep(text)
  if (parsed) return parsed

  // Retry once without more searching: the research is already in the conversation, so ask for the JSON alone.
  console.error('[meeting-prep] unparseable reply, retrying', { personId, stopReason, head: text.slice(0, 300) })
  if (lastContent.length > 0) {
    messages.push({ role: 'assistant', content: lastContent })
    messages.push({
      role: 'user',
      content: 'Do not search again. Using the research above, reply with ONLY the complete JSON object in the required shape: no prose, no code fence. Keep every string concise so the whole object fits.',
    })
    const retry = await client.messages.create({ model: MEETING_PREP_MODEL, max_tokens: MAX_TOKENS, system: SYSTEM, tools, messages })
    const retryText = retry.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
    const retryParsed = parseMeetingPrep(retryText)
    if (retryParsed) return retryParsed
    throw new Error(describeParseFailure(retry.stop_reason, retryText))
  }
  throw new Error(describeParseFailure(stopReason, text))
}

/** Build (or rebuild) the sheet row's content. Never throws; failures land on the row. */
export async function generateMeetingPrep(sheetId: string): Promise<{ ok: boolean; error?: string }> {
  const sheet = await prisma.crmMeetingPrep.findUniqueOrThrow({ where: { id: sheetId } })
  try {
    const content = await buildMeetingPrepContent(sheet.personId, { title: sheet.meetingTitle, at: sheet.meetingAt })
    await prisma.crmMeetingPrep.update({
      where: { id: sheetId },
      data: { content: content as object, generatedAt: new Date(), status: 'READY', error: null },
    })
    captureServerEvent('admin', 'rap_sheet_generated', { sheetId, personId: sheet.personId, sources: content.sources.length })
    return { ok: true }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    await prisma.crmMeetingPrep.update({ where: { id: sheetId }, data: { status: 'FAILED', error } })
    captureServerEvent('admin', 'rap_sheet_failed', { sheetId, personId: sheet.personId, error })
    return { ok: false, error }
  }
}
