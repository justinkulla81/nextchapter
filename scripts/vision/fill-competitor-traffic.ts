/**
 * Fills "website visits a month" on the Competitors page from public Similarweb / Semrush / traffic-estimate snippets.
 *
 *   npx tsx --env-file=.env.local scripts/vision/fill-competitor-traffic.ts --limit 10            pilot, writes
 *   npx tsx --env-file=.env.local scripts/vision/fill-competitor-traffic.ts                       every active card with a site and no figure
 *   add --dry to print without writing
 *
 * Metered: Claude Haiku with up to 2 web searches per company (about $0.02 each). Every call goes to
 * data/geo/research/cost-ledger.jsonl and the run stops at CAP dollars for the step "competitor-traffic".
 * A figure is kept only when the model's quoted evidence contains that number (or a 3-month total that divides to it),
 * so an invented number is dropped. Only empty cards are filled; trafficNote carries the source and says it is an estimate.
 */
import { PrismaClient } from '@prisma/client'
import { ask, jsonOf, pool, spent } from '../geo/_llm'
import { hostOf } from '../../src/lib/vision/competitor-areas'

const prisma = new PrismaClient()
const STEP = 'competitor-traffic'
const CAP = 25
const DRY = process.argv.includes('--dry')
const limit = (() => { const i = process.argv.indexOf('--limit'); return i >= 0 ? Number(process.argv[i + 1]) : Infinity })()

interface Reply { monthlyVisits: number | null; basis?: 'monthly' | 'three_month_total' | 'yearly_total'; source?: string; period?: string; evidence?: string }

/** Every number in a snippet, with K/M/B read out ("1.2M" -> 1.2e6, "1,234,567" -> 1234567). */
function numbersIn(text: string): number[] {
  const out: number[] = []
  for (const m of text.toLowerCase().matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(billion|million|thousand|b|m|k)?\b/g)) {
    const base = parseFloat(m[1].replace(/,/g, ''))
    if (!Number.isFinite(base)) continue
    const u = m[2] ?? ''
    out.push(Math.round(base * (u.startsWith('b') ? 1e9 : u.startsWith('m') ? 1e6 : u === 'k' || u === 'thousand' ? 1e3 : 1)))
  }
  return out
}
const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(a, b) * 0.06

async function one(c: { id: string; name: string; url: string }) {
  const host = hostOf(c.url) ?? c.url
  const { text, cost } = await ask(STEP, CAP,
    `Find the estimated website traffic for ${host} (${c.name}). Search for it on Similarweb, Semrush, Ahrefs or similar public traffic pages and read the figure from the search result text.\n` +
    `Reply with ONLY JSON: {"monthlyVisits": number|null, "basis": "monthly"|"three_month_total"|"yearly_total", "source": "similarweb.com|semrush.com|...", "period": "e.g. Sep 2026", "evidence": "the exact words from the result that state the number"}.\n` +
    `Rules: use null if no result states a visits number for ${host}; never estimate, never use another domain's number; if the page says visits for the last 3 months, report that total with basis "three_month_total"; evidence must quote the number as written.`,
    { searches: 2, maxTokens: 500 })
  const r = jsonOf<Reply>(text)
  if (!r || !r.monthlyVisits || r.monthlyVisits <= 0) return { cost, got: null as null | { v: number; note: string }, why: 'no figure' }
  const div = r.basis === 'three_month_total' ? 3 : r.basis === 'yearly_total' ? 12 : 1
  const stated = r.monthlyVisits
  const nums = numbersIn(r.evidence ?? '')
  if (!nums.some((n) => near(n, stated))) return { cost, got: null, why: 'evidence does not contain the number' }
  const v = Math.round(stated / div)
  const note = `${r.source ?? 'web'}${r.period ? `, ${r.period}` : ''} (estimate${div > 1 ? `; ${stated.toLocaleString()} ${r.basis === 'yearly_total' ? 'a year' : 'over 3 months'} divided` : ''}; read 2026-10-30)`.slice(0, 200)
  return { cost, got: { v, note }, why: '' }
}

async function main() {
  const cards = (await prisma.productCompetitor.findMany({ where: { monthlyVisits: null, status: 'ACTIVE', url: { not: null } }, select: { id: true, name: true, url: true }, orderBy: { name: 'asc' } }))
    .filter((c) => c.url && hostOf(c.url)).slice(0, limit) as { id: string; name: string; url: string }[]
  console.log(`${cards.length} cards to read; spent so far on this step $${spent(STEP).toFixed(2)} of $${CAP}`)
  let got = 0, none = 0, rejected = 0, errors = 0, total = 0
  await pool(cards, 4, async (c, i) => {
    try {
      const r = await one(c)
      total += r.cost
      if (r.got) { got++; if (!DRY) await prisma.productCompetitor.update({ where: { id: c.id }, data: { monthlyVisits: r.got.v, trafficNote: r.got.note } }); console.log(`+ ${c.name}: ${r.got.v.toLocaleString()}  ${r.got.note}`) }
      else if (r.why === 'no figure') none++
      else { rejected++; console.log(`- ${c.name}: ${r.why}`) }
    } catch (e) { errors++; console.log(`! ${c.name}: ${(e as Error).message.slice(0, 120)}`) }
    if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${cards.length}  got ${got}  spent $${total.toFixed(2)}`)
  })
  console.log(`done: ${got} filled, ${none} no public figure, ${rejected} rejected by the evidence check, ${errors} errors; this run $${total.toFixed(2)}, step total $${spent(STEP).toFixed(2)}`)
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
