/**
 * The state-level people behind a layoff, by web search: the head of the state workforce agency,
 * the state workforce board's director, the state director of WIOA and dislocated worker
 * programs, the head of state economic development, and the governor's workforce adviser.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/state-finder.ts search <out.json>
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/state-finder.ts import <out.json> [--apply]
 *
 * Metered: one Claude Sonnet 5.5 request with the web search tool per state (51), printed as it goes.
 * A person is kept only with the page that names them and their title; each page is re-fetched and
 * the name must appear on it, otherwise the CRM note says so. Nothing comes from memory.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '../../src/lib/prisma'
import { addContactToCrm, ensureOrg } from '../../src/lib/crm/add-contact'

const MODEL = 'claude-sonnet-5-5'
const PRICE_IN = 2 / 1e6, PRICE_OUT = 10 / 1e6, PRICE_SEARCH = 10 / 1000
const STATES: [string, string][] = [['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'], ['DC', 'District of Columbia'], ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'], ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'], ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'], ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming']]
const KINDS = ['workforce_agency_head', 'state_workforce_board', 'wioa_programs_director', 'economic_development_head', 'governor_workforce_adviser'] as const
type Kind = (typeof KINDS)[number]
const LABEL: Record<Kind, string> = {
  workforce_agency_head: 'head of the state workforce or labor agency (commissioner, secretary, director)',
  state_workforce_board: 'executive director of the state workforce development board (the WIOA state board)',
  wioa_programs_director: 'state director of WIOA, dislocated worker or adult programs (above the Rapid Response coordinator)',
  economic_development_head: 'head of the state economic development agency',
  governor_workforce_adviser: "the governor's workforce or economic policy adviser",
}

interface Found { name: string; title: string; agency: string; kind: Kind; sourceUrl: string; sourceDate?: string | null; evidence?: string; pageChecked?: 'yes' | 'no' | 'unreachable' }
interface Result { code: string; state: string; people: Found[]; cost: number; searches: number; error?: string }

const SYSTEM = `You find the current senior people in one U.S. state's government who deal with layoffs and workforce programs, from web pages you read with the search tool.

Return only people whose name AND title appear in a page you actually read. Never fill in a name from memory. For each, give the address of that page, the agency's full name, and a short quote. Give the page's date (year and month) if shown. If the only evidence is more than 18 months old and no current agency page confirms the role, leave the person out.

Roles wanted, with the "kind" value:
${KINDS.map((k) => `- ${k}: ${LABEL[k]}`).join('\n')}

At most one person per kind. A kind with no confirmed person is absent. Reply with one JSON object and nothing else:
{"people": [{"name": "", "title": "", "agency": "", "kind": "", "sourceUrl": "", "sourceDate": "YYYY-MM" | null, "evidence": ""}]}`

async function pageNamesPerson(url: string, name: string): Promise<'yes' | 'no' | 'unreachable'> {
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0 Safari/537.36' }, signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return 'unreachable'
    const text = (await res.text()).replace(/<[^>]+>/g, ' ').toLowerCase()
    const parts = name.toLowerCase().replace(/[^a-z\s-]/g, ' ').split(/\s+/).filter((p) => p.length > 1)
    return text.includes(parts[0]) && text.includes(parts[parts.length - 1]) ? 'yes' : 'no'
  } catch { return 'unreachable' }
}

async function lookup(claude: Anthropic, code: string, state: string): Promise<Result> {
  const r: Result = { code, state, people: [], cost: 0, searches: 0 }
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: `State: ${state}. Find the current people in these roles.` }]
  let text = ''
  try {
    for (let turn = 0; turn < 4; turn++) {
      const msg = await claude.messages.create({
        model: MODEL, max_tokens: 6000, system: SYSTEM, messages,
        tools: [{ type: 'web_search_20260318', name: 'web_search', max_uses: 6, response_inclusion: 'excluded' } as never],
        output_config: { effort: 'low' },
      } as never) as Anthropic.Message
      const u = msg.usage as Anthropic.Usage & { server_tool_use?: { web_search_requests?: number } }
      const s = u.server_tool_use?.web_search_requests ?? 0
      r.searches += s
      r.cost += u.input_tokens * PRICE_IN + u.output_tokens * PRICE_OUT + s * PRICE_SEARCH
      text = msg.content.filter((b) => b.type === 'text').map((b) => (b as Anthropic.TextBlock).text).join('')
      if (msg.stop_reason !== 'pause_turn') break
      messages.push({ role: 'assistant', content: msg.content })
    }
  } catch (e) { r.error = e instanceof Error ? e.message.slice(0, 200) : String(e); return r }
  const a = text.indexOf('{'), b = text.lastIndexOf('}')
  let parsed: { people?: Found[] } | null = null
  try { parsed = a >= 0 ? JSON.parse(text.slice(a, b + 1)) : null } catch { parsed = null }
  if (!parsed) { r.error = 'no JSON in reply'; return r }
  const seen = new Set<string>()
  for (const p of parsed.people ?? []) {
    if (!p?.name || !p.title || !p.agency || !p.sourceUrl || !KINDS.includes(p.kind) || p.name.trim().split(/\s+/).length < 2 || seen.has(p.name.toLowerCase())) continue
    seen.add(p.name.toLowerCase())
    r.people.push({ ...p, pageChecked: await pageNamesPerson(p.sourceUrl, p.name) })
  }
  return r
}

async function search(out: string) {
  const claude = new Anthropic()
  const queue = [...STATES]
  const results: Result[] = []
  const worker = async () => {
    for (let s = queue.shift(); s; s = queue.shift()) {
      const r = await lookup(claude, s[0], s[1])
      results.push(r)
      console.log(`${r.state}: ${r.people.length} people, ${r.searches} searches, $${r.cost.toFixed(3)}${r.error ? ` ERROR ${r.error}` : ''}`)
    }
  }
  await Promise.all(Array.from({ length: 3 }, worker))
  writeFileSync(out, JSON.stringify(results, null, 1))
  const total = results.reduce((s, r) => s + r.cost, 0)
  console.log(`done: ${results.length} states, ${results.reduce((s, r) => s + r.people.length, 0)} people, $${total.toFixed(2)} total. Saved ${out}`)
}

async function importFile(file: string, apply: boolean) {
  const results = JSON.parse(readFileSync(file, 'utf8')) as Result[]
  const tally = { people: 0, added: 0, matched: 0, review: 0, removed: 0 }
  for (const r of results) {
    for (const p of r.people) {
      tally.people++
      if (!apply) { console.log(`would add: ${p.name} | ${p.title} | ${p.agency} | ${r.code}`); continue }
      const org = await ensureOrg({ name: p.agency, type: 'GOVERNMENT', state: r.code })
      const res = await addContactToCrm({
        fullName: p.name.trim(), title: p.title, email: null, orgId: org.id, orgName: org.name,
        roles: ['BD_PARTNER'], goals: ['BD'], priority: 'P2',
        note: `${p.title} at ${p.agency} (${r.state}). Found by web search: ${p.sourceUrl}${p.sourceDate ? ` (page dated ${p.sourceDate})` : ''}. `
          + (p.pageChecked === 'yes' ? 'The name was found on that page.' : 'The source page could not be re-checked, so confirm the person and title before emailing.'),
      })
      if (res.outcome === 'removed') tally.removed++
      else tally[res.outcome]++
    }
  }
  console.log(tally)
}

async function main() {
  const [cmd, a, b] = process.argv.slice(2)
  if (cmd === 'search') await search(a ?? 'state-finder.json')
  else if (cmd === 'import') await importFile(a, b === '--apply')
  else console.log('usage: search <out.json> | import <out.json> [--apply]')
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
