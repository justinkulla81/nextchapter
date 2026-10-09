import 'server-only'
import type Anthropic from '@anthropic-ai/sdk'
import { getAnthropicClient } from '@/lib/anthropic'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { gatherRapSheetContext } from './context'
import type { RapSheetContent } from './types'

export const RAP_SHEET_MODEL = 'claude-haiku-4-5-20251001'
const MAX_SEARCHES = 5
const MAX_CONTINUATIONS = 3

const PRODUCT = `NextChapter helps laid-off and displaced white-collar professionals land their next role: a candidate platform (job search plan, coaching, a daily job email, résumé and narrative tools, a network of coaches and recruiters) plus programs sold to institutions. Buyers and partners include workforce boards, economic-development and chamber organizations, universities and alumni offices, outplacement buyers, employers doing layoffs, and funders. The founder, Justin Kulla, is pitching them.`

const SYSTEM = `You are preparing a one-page prospect briefing ("rap sheet") for a founder walking into a pitch. ${PRODUCT}

Rules:
- Use web search to research the prospect's organization and its LOCAL area: recent layoffs and closures (especially white-collar and corporate), regional workforce and economic-development initiatives, programs, grants and funders they run or are part of, and white-collar labor-market metrics (unemployment rate, professional/business services and information-sector employment trends, job openings, major employers' headcount moves). Prefer sources from the last 12 months and say the date.
- The CRM notes below are ground truth about our relationship. Never contradict them.
- Never invent a number, name, date, program or quote. If you cannot find something, say so in "caveats" and leave that list short or empty. A thin, honest briefing beats a padded one.
- Every layoff, initiative and metric should carry a sourceUrl you actually saw in search results, or null.
- The pitch must be specific to THIS person's role and THIS area's conditions: name the local problem, then how NextChapter addresses it. Plain, confident language. No filler, no hype.
- If you cannot tell who the prospect's organization is, say that in caveats and brief on the most likely one, labeled as a guess.

When research is done, reply with ONLY one JSON object (no prose, no code fence) with exactly this shape:
{"headline": string, "whoTheyAre": string, "relationship": string[], "local": {"summary": string, "points": string[]}, "layoffs": {"summary": string, "items": [{"employer": string, "detail": string, "date": string|null, "sourceUrl": string|null}]}, "initiatives": [{"name": string, "detail": string, "sourceUrl": string|null}], "whiteCollar": [{"metric": string, "value": string, "context": string, "sourceUrl": string|null}], "pitch": {"angle": string, "howItHelps": string[], "openingLine": string, "objections": [{"objection": string, "response": string}], "ask": string}, "caveats": string[], "sources": [{"title": string, "url": string}]}`

export function parseRapSheet(raw: string): RapSheetContent | null {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const j = JSON.parse(raw.slice(start, end + 1)) as Partial<RapSheetContent>
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

/** Research and write one rap sheet. This is the metered step: one Claude call with up to MAX_SEARCHES web searches. */
export async function buildRapSheetContent(personId: string, meeting: { title: string | null; at: Date | null }): Promise<RapSheetContent> {
  const ctx = await gatherRapSheetContext(personId)
  const when = meeting.at ? meeting.at.toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'full', timeStyle: 'short' }) + ' ET' : 'upcoming'
  const messages: Anthropic.MessageParam[] = [{
    role: 'user',
    content: `Pitch: ${meeting.title ?? 'meeting'} — ${when}\n\n<crm>\n${ctx.crmText}\n</crm>`,
  }]
  const tools: Anthropic.ToolUnion[] = [{ type: 'web_search_20250305', name: 'web_search', max_uses: MAX_SEARCHES }]

  const client = getAnthropicClient()
  let text = ''
  for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
    const res = await client.messages.create({ model: RAP_SHEET_MODEL, max_tokens: 4000, system: SYSTEM, tools, messages })
    text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
    if (res.stop_reason !== 'pause_turn') break
    messages.push({ role: 'assistant', content: res.content })
  }
  const parsed = parseRapSheet(text)
  if (!parsed) throw new Error('The model did not return a usable rap sheet.')
  return parsed
}

/** Build (or rebuild) the sheet row's content. Never throws; failures land on the row. */
export async function generateRapSheet(sheetId: string): Promise<{ ok: boolean; error?: string }> {
  const sheet = await prisma.crmRapSheet.findUniqueOrThrow({ where: { id: sheetId } })
  try {
    const content = await buildRapSheetContent(sheet.personId, { title: sheet.meetingTitle, at: sheet.meetingAt })
    await prisma.crmRapSheet.update({
      where: { id: sheetId },
      data: { content: content as object, generatedAt: new Date(), status: 'READY', error: null },
    })
    captureServerEvent('admin', 'rap_sheet_generated', { sheetId, personId: sheet.personId, sources: content.sources.length })
    return { ok: true }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    await prisma.crmRapSheet.update({ where: { id: sheetId }, data: { status: 'FAILED', error } })
    captureServerEvent('admin', 'rap_sheet_failed', { sheetId, personId: sheet.personId, error })
    return { ok: false, error }
  }
}
