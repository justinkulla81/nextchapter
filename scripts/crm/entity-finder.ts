/**
 * The people missing from the CRM, by web search, in four tasks: the corporate foundation or community-affairs head at the largest
 * layoff employers, the employment and WARN counsel at national law firms, the state library and its career lead in each state, and
 * the county and city leaders where the layoffs are largest.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/entity-finder.ts search <task> <out.json>
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/entity-finder.ts import <out.json> [--apply]
 *
 * task: foundations | counsel | libraries | localgov. Metered: one Claude Sonnet 5.5 request with the web search tool per target,
 * about $0.12 each. A person is kept only with the page that names them and their title; each page is re-fetched and the name must
 * appear on it, otherwise the CRM note says so. Nothing comes from memory.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import Anthropic from '@anthropic-ai/sdk'
import type { CrmPersonRole } from '@prisma/client'
import { prisma } from '../../src/lib/prisma'
import { addContactToCrm, ensureOrg } from '../../src/lib/crm/add-contact'
import { goalsForRoles } from '../../src/lib/crm/goals'

const MODEL = 'claude-sonnet-5-5'
const PRICE_IN = 2 / 1e6, PRICE_OUT = 10 / 1e6, PRICE_SEARCH = 10 / 1000
type Task = 'foundations' | 'counsel' | 'libraries' | 'localgov'

interface Target { key: string; label: string; state?: string; orgId?: string }
interface Found { name: string; title: string; agency: string; kind: string; sourceUrl: string; sourceDate?: string | null; pageChecked?: 'yes' | 'no' | 'unreachable' }
interface Result { task: Task; target: Target; people: Found[]; cost: number; searches: number; error?: string }

const STATES: [string, string][] = [['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'], ['DC', 'District of Columbia'], ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'], ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'], ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'], ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming']]
const FIRMS = ['Littler Mendelson', 'Jackson Lewis', 'Seyfarth Shaw', 'Ogletree Deakins', 'Fisher Phillips', 'Epstein Becker Green', 'Morgan Lewis', 'Proskauer Rose', 'Paul Hastings', 'Sidley Austin', 'Skadden', 'Orrick', 'DLA Piper', 'Baker McKenzie', 'Akin Gump', 'Holland & Knight', 'Greenberg Traurig', 'K&L Gates', 'Vedder Price', 'Faegre Drinker', 'Winston & Strawn', 'Constangy Brooks Smith & Prophete', 'Foley & Lardner', 'Duane Morris', 'Squire Patton Boggs', 'Venable', 'Hunton Andrews Kurth', 'McGuireWoods', 'Nixon Peabody', 'Polsinelli', 'Troutman Pepper', 'Sheppard Mullin', 'Gibson Dunn', 'Latham & Watkins', 'Ropes & Gray', 'Cooley', 'Goodwin Procter', 'Davis Wright Tremaine', 'Barnes & Thornburg', 'Husch Blackwell']

const ROLES_FOR: Record<Task, { kinds: Record<string, string>; role: CrmPersonRole; orgType: 'GOVERNMENT' | 'VENDOR' | 'EMPLOYER'; ask: (t: Target) => string; scope: string }> = {
  foundations: {
    kinds: { corporate_foundation_head: "head of the company's corporate foundation or philanthropy", community_affairs_head: 'head of corporate social responsibility, community affairs or community investment' },
    role: 'GRANTS', orgType: 'EMPLOYER', scope: 'a U.S. company that has just announced a layoff',
    ask: (t) => `Company: ${t.label}. Find the current people in these roles, if the company has them.`,
  },
  counsel: {
    kinds: { labor_employment_chair: 'chair or co-chair of the labor and employment practice (U.S.)', warn_restructuring_lead: 'lead of the WARN Act, reductions in force or workforce restructuring practice (U.S.)' },
    role: 'ADVISOR', orgType: 'VENDOR', scope: 'a national law firm',
    ask: (t) => `Law firm: ${t.label}. Find the current people in these roles at its U.S. offices.`,
  },
  libraries: {
    kinds: { state_librarian: 'the state librarian (head of the state library agency)', library_career_lead: 'the person leading career, workforce, business or employment resources for the state library or the statewide library network' },
    role: 'BD_PARTNER', orgType: 'GOVERNMENT', scope: 'a U.S. state government',
    ask: (t) => `State: ${t.label}. Find the current people in these roles.`,
  },
  localgov: {
    kinds: { county_leader: 'the county executive, county judge, or chair of the board of commissioners or supervisors', mayor: "the mayor of the county's largest city", local_economic_development: "the economic development director of the county or of the county's largest city" },
    role: 'BD_PARTNER', orgType: 'GOVERNMENT', scope: 'a U.S. county where large layoffs were announced recently',
    ask: (t) => `County: ${t.label}. Find the current people in these roles.`,
  },
}

const systemFor = (task: Task) => `You find the current people in specific roles at ${ROLES_FOR[task].scope}, from web pages you read with the search tool.

Return only people whose name AND title appear in a page you actually read. Never fill in a name from memory. For each, give the address of that page, the organization's full name as "agency", and the date of the page (year and month) if shown. If the only evidence is more than 18 months old and no current page confirms the role, leave the person out.

Roles wanted, with the "kind" value:
${Object.entries(ROLES_FOR[task].kinds).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

At most one person per kind. A kind with no confirmed person is absent. Reply with one JSON object and nothing else:
{"people": [{"name": "", "title": "", "agency": "", "kind": "", "sourceUrl": "", "sourceDate": "YYYY-MM" | null}]}`

async function pageNamesPerson(url: string, name: string): Promise<'yes' | 'no' | 'unreachable'> {
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0 Safari/537.36' }, signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return 'unreachable'
    const text = (await res.text()).replace(/<[^>]+>/g, ' ').toLowerCase()
    const parts = name.toLowerCase().replace(/[^a-z\s-]/g, ' ').split(/\s+/).filter((p) => p.length > 1)
    return text.includes(parts[0]) && text.includes(parts[parts.length - 1]) ? 'yes' : 'no'
  } catch { return 'unreachable' }
}

async function lookup(claude: Anthropic, task: Task, target: Target): Promise<Result> {
  const r: Result = { task, target, people: [], cost: 0, searches: 0 }
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: ROLES_FOR[task].ask(target) }]
  let text = ''
  try {
    for (let turn = 0; turn < 4; turn++) {
      const msg = await claude.messages.create({
        model: MODEL, max_tokens: 6000, system: systemFor(task), messages,
        tools: [{ type: 'web_search_20260318', name: 'web_search', max_uses: 5, response_inclusion: 'excluded' } as never],
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
  const kinds = Object.keys(ROLES_FOR[task].kinds), seen = new Set<string>()
  for (const p of parsed.people ?? []) {
    if (!p?.name || !p.title || !p.sourceUrl || !kinds.includes(p.kind) || p.name.trim().split(/\s+/).length < 2 || seen.has(p.name.toLowerCase())) continue
    seen.add(p.name.toLowerCase())
    r.people.push({ ...p, agency: p.agency || target.label, pageChecked: await pageNamesPerson(p.sourceUrl, p.name) })
  }
  return r
}

async function targetsFor(task: Task): Promise<Target[]> {
  if (task === 'libraries') return STATES.map(([code, name]) => ({ key: code, label: name, state: code }))
  if (task === 'counsel') return FIRMS.map((f) => ({ key: f, label: f }))
  if (task === 'localgov') {
    const areas = await prisma.geoArea.findMany({ where: { level: 'COUNTY', layoffs90d: { gt: 0 } }, orderBy: { layoffs90d: 'desc' }, take: 60, select: { id: true, name: true, state: true } })
    return areas.map((a) => ({ key: a.id, label: `${a.name}, ${a.state}`, state: a.state }))
  }
  // foundations: the 200 largest U.S. WARN filers of the last 90 days, one per company name.
  const groups = await prisma.warnNotice.groupBy({
    by: ['promotedOrgId'], _sum: { employees: true },
    where: { promotedOrgId: { not: null }, source: 'WARN_FILING', state: { not: null }, dismissedAt: null, noticeDate: { gte: new Date(Date.now() - 90 * 86_400_000), lte: new Date() } },
  })
  const orgs = await prisma.crmOrganization.findMany({ where: { id: { in: groups.map((g) => g.promotedOrgId!) } }, select: { id: true, name: true } })
  const byId = new Map(orgs.map((o) => [o.id, o.name]))
  const seen = new Set<string>(), out: Target[] = []
  for (const g of groups.sort((a, b) => (b._sum.employees ?? 0) - (a._sum.employees ?? 0))) {
    const name = (byId.get(g.promotedOrgId!) ?? '').replace(/\*[^*]*\*/g, '').replace(/\(.*?\)/g, '').replace(/,?\s*et\s?al\.?/i, '').replace(/,?\s+(inc|llc|corp|corporation|co|company|ltd)\.?\s*$/i, '').trim()
    const k = name.toLowerCase()
    if (!name || seen.has(k)) continue
    seen.add(k); out.push({ key: g.promotedOrgId!, label: name, orgId: g.promotedOrgId! })
    if (out.length >= 200) break
  }
  return out
}

async function search(task: Task, out: string) {
  const claude = new Anthropic()
  const queue = await targetsFor(task)
  console.log(`${task}: ${queue.length} targets`)
  const results: Result[] = []
  const worker = async () => {
    for (let t = queue.shift(); t; t = queue.shift()) {
      const r = await lookup(claude, task, t)
      results.push(r)
      if (results.length % 10 === 0) { writeFileSync(out, JSON.stringify(results, null, 1)); console.log(`${results.length} done, ${results.reduce((s, x) => s + x.people.length, 0)} people, $${results.reduce((s, x) => s + x.cost, 0).toFixed(2)}`) }
    }
  }
  await Promise.all(Array.from({ length: 3 }, worker))
  writeFileSync(out, JSON.stringify(results, null, 1))
  console.log(`done: ${task}, ${results.length} targets, ${results.reduce((s, x) => s + x.people.length, 0)} people, $${results.reduce((s, x) => s + x.cost, 0).toFixed(2)}. Saved ${out}`)
}

async function importFile(file: string, apply: boolean) {
  const results = JSON.parse(readFileSync(file, 'utf8')) as Result[]
  const tally = { people: 0, added: 0, matched: 0, review: 0, removed: 0 }
  for (const r of results) {
    const cfg = ROLES_FOR[r.task]
    for (const p of r.people) {
      tally.people++
      if (!apply) { console.log(`would add: ${p.name} | ${p.title} | ${p.agency} | ${r.task}`); continue }
      const org = r.target.orgId
        ? { id: r.target.orgId, name: r.target.label }
        : await ensureOrg({ name: p.agency, type: cfg.orgType, state: r.target.state })
      const res = await addContactToCrm({
        fullName: p.name.trim(), title: p.title, email: null, orgId: org.id, orgName: org.name,
        roles: [cfg.role], goals: goalsForRoles([cfg.role]), priority: 'P2',
        note: `${p.title} at ${p.agency}. Found by web search: ${p.sourceUrl}${p.sourceDate ? ` (page dated ${p.sourceDate})` : ''}. `
          + (r.task === 'foundations' ? `The company filed a layoff notice recently. ` : r.task === 'localgov' ? `Large layoffs were announced in ${r.target.label} recently. ` : '')
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
  if (cmd === 'search') await search(a as Task, b ?? `${a}.json`)
  else if (cmd === 'import') await importFile(a, b === '--apply')
  else console.log('usage: search <foundations|counsel|libraries|localgov> <out.json> | import <out.json> [--apply]')
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
