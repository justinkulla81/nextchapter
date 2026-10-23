import 'server-only'
import { getAnthropicClient } from '@/lib/anthropic'
import { cleanAreas, cleanRelationship, parseCustomers, parseLines, parseUsd, parseWins, type NamedEntry, type WinEntry } from './competitor-areas'

/** Haiku 4.5, the same model the geo research runs use. List prices: $1 / $5 per million tokens, web search $10 per 1,000. */
const MODEL = 'claude-haiku-4-5-20251001'
const PRICE = { inPerM: 1, outPerM: 5, perSearch: 0.01 }

/** What we are, so "where we win" and "what we would need" are judged against something real. */
const OUR_PRODUCT = `NextChapter is a job-transition platform for laid-off, long-term-unemployed and career-changing professionals (white-collar, every level). It has: AI and career-change courses; career exploration and pivot paths; coaching and a coach portal; confidential job search; a jobs board of professional roles; resume and cover-letter tools; interview prep; outreach and networking tracking; references; recruiter introductions; layoff-specific tools (WARN notices, rapid response, layoff seats); an employer outplacement portal with per-person outcome reporting; a workspace for workforce boards, states and universities (Program workspace, demos); a catalog of retraining, relocation and benefits programs; local pay and market data.`

export interface EnrichedCompetitor {
  name: string
  segment: string | null
  positioning: string | null
  relationship: string
  areas: string[]
  keyFeatures: string[]
  customers: NamedEntry[]
  wins: WinEntry[]
  weWin: string[]
  theyWin: string[]
  weNeed: string[]
  pricingNote: string | null
  foundedYear: number | null
  hq: string | null
  lastRound: string | null
  investors: string | null
  fundingRaisedUsd: number | null
  headcount: number | null
  revenueNote: string | null
  userCountNote: string | null
  sourceUrl: string | null
  notes: string | null
  status: string
  statusNote: string | null
  lessons: string[]
  partnerIdea: string | null
}

const AREA_LIST = 'coaching, career_exploration, job_search, resume, interview_prep, networking, learning, ai_reskilling, fractional, community, recruiters, benefits, outplacement, workforce_system, labor_data, assessments, employer_hiring, higher_ed'

function jsonOf<T>(text: string): T | null {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, text]
  const body = (m[1] as string).trim()
  const start = body.search(/[\[{]/)
  if (start < 0) return null
  for (let end = body.length; end > start; end--) {
    const ch = body[end - 1]
    if (ch !== ']' && ch !== '}') continue
    try { return JSON.parse(body.slice(start, end)) as T } catch { /* shorten */ }
  }
  return null
}

const str = (v: unknown, max = 600): string | null => { const s = String(v ?? '').trim(); return s && !/^(unknown|n\/a|not (stated|found|public))/i.test(s) ? s.slice(0, max) : null }
const int = (v: unknown, lo: number, hi: number): number | null => { const n = typeof v === 'number' ? v : parseInt(String(v ?? '').replace(/[^\d]/g, ''), 10); return Number.isFinite(n) && n >= lo && n <= hi ? n : null }

/** Reads a competitor's website (and a little public reporting) and returns a draft card. Never invents numbers. */
export async function enrichCompetitor(homepage: string, hint?: string): Promise<{ data: EnrichedCompetitor; cost: number; searches: number }> {
  const prompt = `Research the company at ${homepage} for a competitor card. NextChapter wants to know how this company compares with it.${hint ? `\nContext on why it is on our list: ${hint}` : ''}

${OUR_PRODUCT}

Open the company's own site (home, product, customers, pricing, about, news pages as needed). You may run up to 3 web searches for funding, headcount, revenue and notable customers or contract wins. Prefer the company's own pages, then press and filings.

Return ONE JSON object in a json code block with exactly these keys:
{
 "name": company name,
 "segment": short market label (e.g. "Outplacement", "Career navigation for governments", "Resume builder"),
 "positioning": one or two plain sentences: what they sell and to whom,
 "relationship": "DIRECT" if they sell what we sell to the same people, "ADJACENT" if they overlap in part or sell to a different buyer, "PARTNER" if complementary and more useful beside us than against us (many tools are: say so rather than defaulting to competitor), "SUPPLIER" if a data or tool supplier we could buy from or build on,
 "areas": array chosen ONLY from: ${AREA_LIST}. Include an area only if the company really sells that capability to someone we could lose to; do not stretch (ai_reskilling means they sell training, not that they use AI),
 "keyFeatures": up to 10 short product features they list,
 "customers": up to 15 named customers or users they or the press name: [{"name","note","url"}],
 "wins": grants, funding, contracts or RFPs they have won (government or large buyers): [{"what","buyer","amount","year","url"}],
 "weWin": up to 5 specific places NextChapter is likely stronger, judged from what you read,
 "theyWin": up to 5 specific places they are stronger,
 "weNeed": up to 5 features NextChapter would need to build or improve to compete where they lead,
 "pricingNote": published pricing in a short phrase, or null,
 "foundedYear": number or null, "hq": "City, ST/Country" or null,
 "lastRound": e.g. "$24M Series B, 2025" or null, "investors": names or null,
 "fundingRaisedUsd": total raised in US dollars as a number, or null,
 "headcount": number of employees, or null,
 "revenueNote": reported revenue or ARR with the year and "(reported)" or "(estimate)", or null,
 "userCountNote": users, customers or placements they claim, or null,
 "sourceUrl": the single best page for the numbers above, or null,
 "notes": anything a founder should know that does not fit above, or null,
 "status": "ACTIVE", "ACQUIRED" (bought or merged away), "SHUT_DOWN" (stopped operating, went bankrupt or wound down) or "PIVOTED" (left this market),
 "statusNote": when status is not ACTIVE: what happened, when, and why, in one or two sentences with the year; otherwise null,
 "lessons": when status is not ACTIVE or the company has visibly struggled (layoffs, down round, losing customers): 2 to 4 concrete lessons for NextChapter, each tied to a fact you found; otherwise an empty array,
 "partnerIdea": if the company is more useful beside us than against us, one sentence on how we could work together (referral, integration, data, channel); otherwise null
}
Rules: use null for anything you could not find; never guess a number; separate what the company claims from what a third party reports in the note text; keep every list item under 140 characters.`

  const client = getAnthropicClient()
  const tools = [
    { type: 'web_fetch_20250910', name: 'web_fetch', max_uses: 5, max_content_tokens: 20000 },
    { type: 'web_search_20250305', name: 'web_search', max_uses: 3 },
  ]
  const r = await (client.beta.messages.create as unknown as (a: unknown) => Promise<{ usage: { input_tokens: number; output_tokens: number; server_tool_use?: { web_search_requests?: number } }; content: { type: string; text?: string }[] }>)({
    model: MODEL, max_tokens: 4000, betas: ['web-fetch-2025-09-10'], tools, messages: [{ role: 'user', content: prompt }],
  })
  const searches = r.usage.server_tool_use?.web_search_requests ?? 0
  const cost = (r.usage.input_tokens * PRICE.inPerM + r.usage.output_tokens * PRICE.outPerM) / 1e6 + searches * PRICE.perSearch
  const text = r.content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('\n')
  const j = jsonOf<Record<string, unknown>>(text)
  if (!j) throw new Error('The model did not return a readable card')
  const data: EnrichedCompetitor = {
    name: str(j.name, 120) ?? new URL(homepage).hostname,
    segment: str(j.segment, 120), positioning: str(j.positioning, 700),
    relationship: cleanRelationship(j.relationship), areas: cleanAreas(j.areas),
    keyFeatures: parseLines(j.keyFeatures, 10).map((x) => x.slice(0, 140)),
    customers: parseCustomers(j.customers, 15), wins: parseWins(j.wins, 15),
    weWin: parseLines(j.weWin, 5).map((x) => x.slice(0, 160)), theyWin: parseLines(j.theyWin, 5).map((x) => x.slice(0, 160)),
    weNeed: parseLines(j.weNeed, 5).map((x) => x.slice(0, 160)),
    pricingNote: str(j.pricingNote, 200), foundedYear: int(j.foundedYear, 1900, 2030), hq: str(j.hq, 80),
    lastRound: str(j.lastRound, 120), investors: str(j.investors, 200),
    fundingRaisedUsd: parseUsd(j.fundingRaisedUsd), headcount: int(j.headcount, 1, 2_000_000),
    revenueNote: str(j.revenueNote, 160), userCountNote: str(j.userCountNote, 160),
    status: ['ACQUIRED', 'SHUT_DOWN', 'PIVOTED'].includes(String(j.status)) ? String(j.status) : 'ACTIVE',
    statusNote: str(j.statusNote, 400), lessons: parseLines(j.lessons, 5).map((x) => x.slice(0, 220)), partnerIdea: str(j.partnerIdea, 240),
    sourceUrl: /^https?:\/\//.test(String(j.sourceUrl ?? '')) ? String(j.sourceUrl) : null, notes: str(j.notes, 800),
  }
  return { data, cost, searches }
}
