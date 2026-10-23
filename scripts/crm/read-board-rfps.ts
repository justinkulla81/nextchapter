/**
 * Reads the board RFPs we found (docs/funding/company-sweep/board_rfps.csv) and fills in what a salesperson needs:
 * who may bid (for-profit or not), the scope, due date, budget, term, contact, and what we could do (prime, sub, no).
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/read-board-rfps.ts --run [--limit 5]   metered, about $0.10 each
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/read-board-rfps.ts --apply            write to the leads
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { PrismaClient, type CrmEligibility } from '@prisma/client'
import { ask, jsonOf, pool, spent } from '../geo/_llm'
import { toRows, parseDateish } from './parse'

const prisma = new PrismaClient()
const STEP = 'board-rfp-read'
const CAP = 20
const OUT = 'data/geo/research/board-rfps-read.json'
const arg = (k: string) => process.argv.includes(k)
const limit = (() => { const i = process.argv.indexOf('--limit'); return i >= 0 ? parseInt(process.argv[i + 1], 10) : 0 })()

interface Read {
  title?: string; scope?: string; dueDate?: string | null; questionsDue?: string | null; budget?: string | null; term?: string | null
  forProfitMayBid?: 'yes' | 'no' | 'unclear'; eligibilityQuote?: string | null; whoWins?: string | null
  contactName?: string | null; contactEmail?: string | null; contactPhone?: string | null; submitVia?: string | null
  fitForNextChapter?: 'prime' | 'subcontract or partner' | 'not a fit'; whyFit?: string; status?: 'open' | 'closed' | 'unclear'
}

async function run() {
  const rows = toRows(readFileSync('docs/funding/company-sweep/board_rfps.csv', 'utf8'))
  const done: Record<string, Read> = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {}
  const todo = rows.filter((r) => r.get('Link') && !done[r.get('Link')!]).slice(0, limit || undefined)
  console.log(`${rows.length} RFPs, ${todo.length} to read (about $${(todo.length * 0.1).toFixed(0)}), spent $${spent(STEP).toFixed(2)} of $${CAP}`)
  mkdirSync('data/geo/research', { recursive: true })
  await pool(todo, 4, async (r) => {
    if (spent(STEP) >= CAP) return
    const url = r.get('Link')!
    const prompt = `Open this solicitation from a workforce board and read it: ${url}
Buyer: ${r.get('Organization')}. Listed as: ${r.get('Opportunity')}.
NextChapter is a for-profit job-transition company: AI reskilling and career-pivot courses, coaching, layoff support, a participant workspace for workforce boards, a jobs board for professional roles. Say whether this is something we could bid on or sub to.
Return ONE JSON object in a json code block; null when not stated, never guess:
{"title":"","scope":"two sentences on what is being bought","dueDate":"YYYY-MM-DD or null","questionsDue":"YYYY-MM-DD or null","budget":"amount or range as written","term":"contract length","forProfitMayBid":"yes|no|unclear","eligibilityQuote":"the sentence that says who may apply (under 40 words)","whoWins":"incumbent or past awardee if named","contactName":"","contactEmail":"","contactPhone":"","submitVia":"email, portal, mail","fitForNextChapter":"prime|subcontract or partner|not a fit","whyFit":"one sentence","status":"open|closed|unclear (today is 2026-10-23)"}`
    try {
      const res = await ask(STEP, CAP, prompt, { fetches: 3, maxTokens: 1800 })
      const j = jsonOf<Read>(res.text)
      if (j) { done[url] = j; writeFileSync(OUT, JSON.stringify(done, null, 1)) }
    } catch (e) { console.log(`  skip ${url.slice(0, 70)}: ${(e as Error).message.slice(0, 60)}`) }
  })
  console.log(`read; spent $${spent(STEP).toFixed(2)}`)
}

async function apply() {
  const done: Record<string, Read> = JSON.parse(readFileSync(OUT, 'utf8'))
  const leads = await prisma.crmOpportunity.findMany({ where: { url: { in: Object.keys(done) } }, select: { id: true, url: true, orgId: true, nextStep: true } })
  let n = 0
  for (const l of leads) {
    const r = done[l.url!]; if (!r) continue
    const elig: CrmEligibility = r.forProfitMayBid === 'yes' ? 'FOR_PROFIT_ELIGIBLE' : r.forProfitMayBid === 'no' ? 'NONPROFIT_ONLY' : 'UNKNOWN'
    const due = parseDateish(r.dueDate ?? '')
    const note = [
      `Read ${new Date().toISOString().slice(0, 10)}: ${r.scope ?? ''}`.trim(),
      `Who may bid: ${r.forProfitMayBid ?? 'unclear'}${r.eligibilityQuote ? ` — "${r.eligibilityQuote}"` : ''}`,
      r.fitForNextChapter ? `Fit: ${r.fitForNextChapter}${r.whyFit ? ` — ${r.whyFit}` : ''}` : null,
      r.budget ? `Budget: ${r.budget}` : null, r.term ? `Term: ${r.term}` : null, r.whoWins ? `Incumbent or past award: ${r.whoWins}` : null,
      r.questionsDue ? `Questions due: ${r.questionsDue}` : null, r.submitVia ? `Submit via: ${r.submitVia}` : null,
      r.contactName || r.contactEmail ? `Contact: ${[r.contactName, r.contactEmail, r.contactPhone].filter(Boolean).join(' · ')}` : null,
      r.status ? `Status: ${r.status}` : null,
    ].filter(Boolean).join('\n')
    await prisma.crmOpportunity.update({ where: { id: l.id }, data: { eligibility: elig, nextStep: note, ...(r.fitForNextChapter === 'not a fit' ? { leadQuality: 'D' } : r.forProfitMayBid === 'yes' ? { leadQuality: 'B' } : {}) } })
    if (due && l.orgId && r.status !== 'closed') {
      const dl = await prisma.crmDeadline.findFirst({ where: { opportunityId: l.id }, select: { id: true } })
      if (dl) await prisma.crmDeadline.update({ where: { id: dl.id }, data: { dueAt: due, rawText: null, kind: 'APPLICATION_CLOSE' } })
    }
    n++
  }
  const tally = Object.values(done).reduce<Record<string, number>>((a, r) => { const k = `${r.forProfitMayBid ?? 'unclear'} / ${r.fitForNextChapter ?? '?'}`; a[k] = (a[k] ?? 0) + 1; return a }, {})
  console.log(`updated ${n} leads`, tally)
}
if (arg('--run')) run().finally(() => prisma.$disconnect())
else if (arg('--apply')) apply().finally(() => prisma.$disconnect())
else console.log('Use --run [--limit N] or --apply')
