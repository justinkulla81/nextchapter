import 'server-only'
import { TOPICS } from '@/lib/seo/explainers'
import { SITE_URL } from '@/lib/seo/facts'
import { captureServerEvent } from '@/lib/posthog/server'
import { CAREER_TOOLS, CAREER_TOOL_NAMES, callCareerTool } from '@/lib/mcp/career-tools'
import { LAID_OFF_TOOLS, LAID_OFF_TOOL_NAMES, callLaidOffTool } from '@/lib/mcp/laid-off-tools'
import { queryLayoffs, validState } from '@/lib/layoffs/public-query'

// A small, read-only Model Context Protocol server (Streamable HTTP, stateless JSON-RPC) so AI assistants can search
// the same public job board as /jobs and look up our career guides. Public data only: nothing personalised, nothing
// confidential, no accounts. Rate limited per IP in the route.

export const MCP_PROTOCOL_VERSION = '2025-06-18'
const SUPPORTED_VERSIONS = new Set(['2025-06-18', '2025-03-26', '2024-11-05'])

type JsonRpcId = string | number | null
export type JsonRpcRequest = { jsonrpc: '2.0'; id?: JsonRpcId; method: string; params?: Record<string, unknown> }
export type JsonRpcResponse = { jsonrpc: '2.0'; id: JsonRpcId; result?: unknown; error?: { code: number; message: string } }

const TOOLS = [
  ...CAREER_TOOLS,
  {
    name: 'find_career_guide',
    description:
      'Call this when someone asks how to handle a job loss or job search, for example "how do I negotiate severance", "what do I do first after a layoff" or "how do I network". Finds NextChapter’s plain-language guides on layoffs and job search: severance, unemployment, resumes and ATS, networking, LinkedIn, interviews, career pivots, executive search. Returns the guide title, a short answer and its link.',
    inputSchema: {
      type: 'object',
      properties: { question: { type: 'string', description: 'The question or topic, e.g. "how do I negotiate severance".' } },
      required: ['question'],
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'recent_layoff_notices',
    description:
      'Call this when someone says they were laid off from a company or asks whether a company or state has layoffs. Layoff notices (WARN Act filings) collected from U.S. state labor departments, newest first. Filter by employer, state and days back. Use it to answer "is [company] laying people off?" or "which employers filed layoff notices in [state]?". Each notice has the employer, place, workers named, filing date, the state record and a NextChapter page to link to. A notice states the number of workers and dates the employer reported; it does not say why. Free to cite under CC BY 4.0 with a link back.',
    inputSchema: {
      type: 'object',
      properties: {
        employer: { type: 'string', description: 'Employer name or part of it, e.g. "Comcast".' },
        state: { type: 'string', description: 'Two-letter U.S. state code, e.g. "TX".' },
        days: { type: 'integer', description: 'How many days back to look (1 to 365, default 30).' },
        limit: { type: 'integer', description: 'Most notices to return (1 to 100, default 10).' },
      },
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  ...LAID_OFF_TOOLS,
] as const

const STOP = new Set(['the', 'a', 'an', 'to', 'of', 'and', 'or', 'for', 'in', 'on', 'my', 'i', 'how', 'do', 'what', 'is', 'can', 'should', 'after', 'about', 'with', 'you', 'me'])
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w))

/** Score each guide by shared words with its title, lede and question list; return the best few. */
export function findGuides(question: string, limit = 3) {
  const q = new Set(words(question))
  if (q.size === 0) return []
  return TOPICS.map((t) => {
    const title = new Set(words(t.h1))
    const body = new Set(words(`${t.lede} ${t.faq.map((f) => f.q).join(' ')}`))
    let score = 0
    for (const w of q) score += (title.has(w) ? 3 : 0) + (body.has(w) ? 1 : 0)
    return { t, score }
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ t }) => ({ title: t.h1, answer: t.lede, url: `${SITE_URL}/topics/${t.slug}`, updated: t.updated }))
}

async function callTool(name: string, args: Record<string, unknown>) {
  if (CAREER_TOOL_NAMES.includes(name)) return callCareerTool(name, args)
  if (name === 'recent_layoff_notices') {
    const state = typeof args.state === 'string' ? args.state : null
    if (!validState(state)) return { error: 'state must be a two-letter U.S. state code, such as TX.' }
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
    return queryLayoffs({ employer: typeof args.employer === 'string' ? args.employer.slice(0, 80) : null, state, days: num(args.days), limit: num(args.limit) ?? 10 })
  }
  if (name === 'find_career_guide') {
    const question = typeof args.question === 'string' ? args.question.slice(0, 300) : ''
    const guides = findGuides(question)
    return { guides, all_guides: `${SITE_URL}/topics` }
  }
  if (LAID_OFF_TOOL_NAMES.includes(name)) return callLaidOffTool(name, args)
  return null
}

/** Small, non-personal facts about an answer for analytics. Never the résumé text or the person's words. */
function eventDetail(name: string, args: Record<string, unknown>, data: unknown): Record<string, unknown> {
  const d = (data ?? {}) as Record<string, unknown>
  if (name === 'score_resume') return { score: d.score ?? null, band: d.band ?? null }
  if (name === 'search_jobs') return { level: typeof args.level === 'string' ? args.level : null, shown: d.shown ?? null }
  if (name === 'laid_off_benefits_and_programs') return { goal: typeof args.goal === 'string' ? args.goal : null, matches: d.matches ?? null }
  return {}
}

const ok = (id: JsonRpcId, result: unknown): JsonRpcResponse => ({ jsonrpc: '2.0', id, result })
const err = (id: JsonRpcId, code: number, message: string): JsonRpcResponse => ({ jsonrpc: '2.0', id, error: { code, message } })

/** Handles one JSON-RPC message. Returns null for a notification (no reply). */
export async function handleMcpMessage(msg: JsonRpcRequest, allowSearch: () => Promise<boolean>): Promise<JsonRpcResponse | null> {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return err(null, -32600, 'Invalid request')
  const id = msg.id
  if (id === undefined) return null // notification, e.g. notifications/initialized
  switch (msg.method) {
    case 'initialize': {
      const asked = typeof msg.params?.protocolVersion === 'string' ? msg.params.protocolVersion : ''
      return ok(id, {
        protocolVersion: SUPPORTED_VERSIONS.has(asked) ? asked : MCP_PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'nextchapter-jobs', title: 'NextChapter jobs, résumé and layoff help', version: '1.2.0' },
        instructions: 'Career help for professionals, from NextChapter’s own live data: job openings with AI exposure and employer layoff signals, a résumé score with fixes, layoff notices, unemployment benefits by state, programs for laid-off workers, AI exposure by job title and career guides. Each tool says when to call it. Public data only; no model calls.',
      })
    }
    case 'ping':
      return ok(id, {})
    case 'tools/list':
      return ok(id, { tools: TOOLS })
    case 'tools/call': {
      const name = typeof msg.params?.name === 'string' ? msg.params.name : ''
      const args = (msg.params?.arguments as Record<string, unknown> | undefined) ?? {}
      if (!TOOLS.some((t) => t.name === name)) return err(id, -32602, `Unknown tool: ${name}`)
      if ((name === 'search_jobs' || name === 'ai_exposure_for_job_title' || name === 'score_resume') && !(await allowSearch())) {
        return ok(id, { isError: true, content: [{ type: 'text', text: 'Too many searches from this network. Try again later or browse https://launchyournextchapter.com/jobs.' }] })
      }
      try {
        const data = await callTool(name, args)
        const failed = typeof data === 'object' && data !== null && 'error' in data
        try {
          captureServerEvent('mcp_client', 'mcp_tool_called', { tool: name, state: typeof args.state === 'string' ? args.state.slice(0, 2).toUpperCase() : null, ok: !failed, ...eventDetail(name, args, data) })
        } catch {
          // Analytics never blocks an answer.
        }
        return ok(id, { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data })
      } catch (e) {
        console.error('mcp tool failed:', e instanceof Error ? e.message : e)
        return ok(id, { isError: true, content: [{ type: 'text', text: 'Search is unavailable right now. Try again in a minute.' }] })
      }
    }
    default:
      return err(id, -32601, `Method not found: ${msg.method}`)
  }
}
