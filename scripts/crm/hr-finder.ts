/**
 * Finds the HR people at U.S. employers that filed a layoff notice, by web search, and
 * puts them in the CRM. Two steps, so a search is never paid for twice:
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/hr-finder.ts search <n> <out.json>
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/hr-finder.ts import <out.json> [--apply]
 *
 * search: the <n> largest U.S. WARN filers of the last 90 days that have no HR leader in the
 * CRM yet. For each, one Claude Sonnet 5.5 request with the web search tool looks for the head
 * of HR, total rewards, employee relations, talent acquisition, HR business partners and
 * learning heads. Metered: tokens plus $10 per 1,000 searches, printed as it goes.
 *
 * Rules kept: a person is kept only with the page that names them and their title; each source
 * page is re-fetched and the name must appear on it (otherwise the note says so); nothing
 * comes from the model's memory; a name that matches someone already in the CRM goes to the
 * Review List instead of being merged (addContactToCrm).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import Anthropic from '@anthropic-ai/sdk'
import type { CrmPersonRole } from '@prisma/client'
import { prisma } from '../../src/lib/prisma'
import { addContactToCrm } from '../../src/lib/crm/add-contact'
import { goalsForRoles } from '../../src/lib/crm/goals'
import { isHrLeaderTitle, receivesMail } from '../../src/lib/crm/org-domains'

const MODEL = 'claude-sonnet-5-5'
const PRICE_IN = 2 / 1e6, PRICE_OUT = 10 / 1e6, PRICE_SEARCH = 10 / 1000

const KINDS = ['head_hr', 'total_rewards', 'employee_relations', 'talent_acquisition', 'hr_business_partner', 'learning_development'] as const
type Kind = (typeof KINDS)[number]
const KIND_LABEL: Record<Kind, string> = {
  head_hr: 'head of HR (CHRO, chief people officer, EVP/SVP HR)',
  total_rewards: 'total rewards / compensation and benefits',
  employee_relations: 'employee relations / labor relations',
  talent_acquisition: 'talent acquisition',
  hr_business_partner: 'HR business partner or HR director for a business unit or region',
  learning_development: 'learning and development',
}
const ROLES: Record<Kind, CrmPersonRole[]> = {
  head_hr: ['HIRING_MANAGER', 'OUTPLACEMENT_BUYER'],
  total_rewards: ['OUTPLACEMENT_BUYER'],
  employee_relations: ['OUTPLACEMENT_BUYER'],
  talent_acquisition: ['OUTPLACEMENT_BUYER'],
  hr_business_partner: ['OUTPLACEMENT_BUYER'],
  learning_development: ['LEARNING_DEV_HEAD'],
}

interface Found { name: string; title: string; kind: Kind; scope?: string; sourceUrl: string; sourceDate?: string | null; evidence?: string; linkedinUrl?: string | null; pageChecked?: 'yes' | 'no' | 'unreachable' }
interface Result { mode?: 'warn' | 'leads'; orgId: string; org: string; state: string | null; employees: number | null; domain: string | null; people: Found[]; cost: number; searches: number; error?: string }

const SYSTEM = `You find the people who run human resources at a company, from web pages you read with the search tool.

Return only people whose name AND job title appear in a page you actually read. Never fill in a name from memory. For each person give the address of that page and a short quote from it. Give the date of the page (year and month) if it shows one. If the only evidence is more than 24 months old and no current company page, filing or recent article confirms the role, leave the person out.

The roles wanted, with the "kind" value to use:
${KINDS.map((k) => `- ${k}: ${KIND_LABEL[k]}`).join('\n')}

Prefer company-wide leaders over regional ones, and U.S.-based people. Up to six people in total, at most two per kind. A kind with no confirmed person is simply absent. Also give the company's main web domain (for email) if you saw it.

Reply with one JSON object and nothing else:
{"domain": "example.com" | null, "people": [{"name": "", "title": "", "kind": "", "scope": "company-wide" | "business unit" | "region", "sourceUrl": "", "sourceDate": "YYYY-MM" | null, "evidence": "", "linkedinUrl": null}]}`

async function pageNamesPerson(url: string, name: string): Promise<'yes' | 'no' | 'unreachable'> {
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0 Safari/537.36' }, signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return 'unreachable'
    const text = (await res.text()).replace(/<[^>]+>/g, ' ').toLowerCase()
    const parts = name.toLowerCase().replace(/[^a-z\s-]/g, ' ').split(/\s+/).filter((p) => p.length > 1)
    const [first, last] = [parts[0], parts[parts.length - 1]]
    return text.includes(first) && text.includes(last) ? 'yes' : 'no'
  } catch { return 'unreachable' }
}

function parseJson(text: string): { domain: string | null; people: Found[] } | null {
  const a = text.indexOf('{'), b = text.lastIndexOf('}')
  if (a < 0 || b < a) return null
  try { return JSON.parse(text.slice(a, b + 1)) } catch { return null }
}

async function lookup(claude: Anthropic, org: { id: string; name: string }, state: string | null, employees: number | null): Promise<Result> {
  const r: Result = { orgId: org.id, org: org.name, state, employees, domain: null, people: [], cost: 0, searches: 0 }
  const prompt = `Company: ${org.name}${state ? ` (U.S. state of the layoff filing: ${state})` : ''}${employees ? `, ${employees} employees affected` : ''}. Find its current HR people.`
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: prompt }]
  let text = ''
  try {
    for (let turn = 0; turn < 4; turn++) {
      const msg = await claude.messages.create({
        model: MODEL, max_tokens: 6000, system: SYSTEM, messages,
        tools: [{ type: 'web_search_20260318', name: 'web_search', max_uses: 5, response_inclusion: 'excluded' } as never],
        output_config: { effort: 'low' },
      } as never) as Anthropic.Message
      const u = msg.usage as Anthropic.Usage & { server_tool_use?: { web_search_requests?: number } }
      const searches = u.server_tool_use?.web_search_requests ?? 0
      r.searches += searches
      r.cost += u.input_tokens * PRICE_IN + u.output_tokens * PRICE_OUT + searches * PRICE_SEARCH
      text = msg.content.filter((b) => b.type === 'text').map((b) => (b as Anthropic.TextBlock).text).join('')
      if (msg.stop_reason !== 'pause_turn') break
      messages.push({ role: 'assistant', content: msg.content })
    }
  } catch (e) { r.error = e instanceof Error ? e.message.slice(0, 200) : String(e); return r }
  const parsed = parseJson(text)
  if (!parsed) { r.error = 'no JSON in reply'; return r }
  r.domain = parsed.domain ?? null
  const seen = new Set<string>()
  for (const p of parsed.people ?? []) {
    if (!p?.name || !p.title || !p.sourceUrl || !KINDS.includes(p.kind) || p.name.trim().split(/\s+/).length < 2) continue
    const key = p.name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    r.people.push({ ...p, pageChecked: await pageNamesPerson(p.sourceUrl, p.name) })
  }
  return r
}

async function search(n: number, out: string) {
  const claude = new Anthropic()
  // HR_MODE=leads searches the A-grade outplacement leads with a U.S. state instead of WARN filers.
  const leads = process.env.HR_MODE === 'leads'
  const notices = leads
    ? (await prisma.crmOrganization.findMany({
        where: { leadQuality: 'A', outplacementProfile: { isNot: null }, usState: { not: null } },
        select: { id: true, outplacementProfile: { select: { headcountAffected: true } } },
      })).map((o) => ({ promotedOrgId: o.id as string | null, _sum: { employees: o.outplacementProfile?.headcountAffected ?? 0 } }))
    : await prisma.warnNotice.groupBy({
        by: ['promotedOrgId'],
        where: { promotedOrgId: { not: null }, source: 'WARN_FILING', state: { not: null }, dismissedAt: null, noticeDate: { gte: new Date(Date.now() - 90 * 86_400_000) } },
        _sum: { employees: true },
      })
  const withHr = new Set((await prisma.crmAffiliation.findMany({ where: { isCurrent: true, person: { deletedAt: null } }, select: { orgId: true, title: true } }))
    .filter((a) => isHrLeaderTitle(a.title)).map((a) => a.orgId))
  // HR_FINDER_SKIP: a earlier results file whose employers are not searched again. HR_MIN: smallest filing to search (default 100).
  const skip = new Set<string>()
  for (const f of (process.env.HR_FINDER_SKIP ?? '').split(',').filter(Boolean)) for (const r of JSON.parse(readFileSync(f, 'utf8')) as Result[]) skip.add(r.orgId)
  const min = Number(process.env.HR_MIN ?? 100)
  const ids = notices.filter((p) => !withHr.has(p.promotedOrgId!) && !skip.has(p.promotedOrgId!) && (p._sum.employees ?? 0) >= min)
    .sort((a, b) => (b._sum.employees ?? 0) - (a._sum.employees ?? 0)).slice(0, n)
  const orgs = await prisma.crmOrganization.findMany({ where: { id: { in: ids.map((i) => i.promotedOrgId!) } } })
  const state = leads
    ? new Map(orgs.map((o) => [o.id, o.usState] as [string | null, string | null]))
    : new Map((await prisma.warnNotice.findMany({ where: { promotedOrgId: { in: orgs.map((o) => o.id) } }, select: { promotedOrgId: true, state: true }, distinct: ['promotedOrgId'] })).map((w) => [w.promotedOrgId, w.state] as [string | null, string | null]))
  const queue = ids.map((i) => ({ org: orgs.find((o) => o.id === i.promotedOrgId)!, employees: i._sum.employees })).filter((x) => x.org)
  console.log(`${queue.length} employers to search`)
  const results: Result[] = []
  const worker = async () => {
    for (let q = queue.shift(); q; q = queue.shift()) {
      const r = await lookup(claude, q.org, state.get(q.org.id) ?? null, q.employees ?? null)
      r.mode = leads ? 'leads' : 'warn'
      results.push(r)
      console.log(`${r.org} [${r.employees ?? '?'}]: ${r.people.length} people, ${r.searches} searches, $${r.cost.toFixed(3)}${r.error ? ` ERROR ${r.error}` : ''}`)
      for (const p of r.people) console.log(`   ${p.kind}: ${p.name}, ${p.title} (${p.sourceDate ?? 'no date'}, page ${p.pageChecked})`)
    }
  }
  await Promise.all(Array.from({ length: 3 }, worker))
  writeFileSync(out, JSON.stringify(results, null, 1))
  const total = results.reduce((s, r) => s + r.cost, 0)
  console.log(`done: ${results.length} employers, ${results.reduce((s, r) => s + r.people.length, 0)} people, ${results.reduce((s, r) => s + r.searches, 0)} searches, $${total.toFixed(2)} total, $${(total / Math.max(1, results.length)).toFixed(3)} per employer. Saved ${out}`)
}

async function importFile(file: string, apply: boolean) {
  const results = JSON.parse(readFileSync(file, 'utf8')) as Result[]
  const tally = { people: 0, added: 0, matched: 0, review: 0, removed: 0, domains: 0 }
  for (const r of results) {
    const org = await prisma.crmOrganization.findUnique({ where: { id: r.orgId } })
    if (!org) continue
    if (apply && r.domain && !org.emailDomain && (await receivesMail(r.domain))) {
      await prisma.crmOrganization.update({ where: { id: org.id }, data: { emailDomain: r.domain, emailDomainSource: 'web search' } })
      tally.domains++
    }
    for (const p of r.people) {
      tally.people++
      const roles = ROLES[p.kind]
      const why = r.mode === 'leads' ? 'an outplacement lead (recent layoff)' : 'which filed a WARN layoff notice'
      const note = `${p.title} at ${org.name}, ${why}${r.employees ? ` (${r.employees} employees)` : ''}. Found by web search: ${p.sourceUrl}${p.sourceDate ? ` (page dated ${p.sourceDate})` : ''}. `
        + (p.pageChecked === 'yes' ? 'The name was found on that page.' : 'The source page could not be re-checked, so confirm the person and title before emailing.')
      if (!apply) { console.log(`would add: ${p.name} | ${p.title} | ${org.name} | ${p.kind}`); continue }
      const res = await addContactToCrm({
        fullName: p.name.trim(), title: p.title, email: null, linkedinUrl: p.linkedinUrl ?? null,
        orgId: org.id, orgName: org.name, roles, goals: goalsForRoles(roles), priority: p.kind === 'head_hr' ? 'P1' : 'P2', note,
      })
      if (res.outcome === 'removed') tally.removed++
      else tally[res.outcome]++
    }
  }
  console.log(tally)
}

async function main() {
  const [cmd, a, b] = process.argv.slice(2)
  if (cmd === 'search') await search(Number(a ?? 15), b ?? 'hr-finder.json')
  else if (cmd === 'import') await importFile(a, b === '--apply')
  else console.log('usage: search <n> <out.json> | import <out.json> [--apply]')
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
