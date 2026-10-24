/**
 * Funding leads whose role came back "ROLE UNKNOWN" (the page was blocked or said nothing the first time) get a second read
 * by the research API, which is not stopped by the bot walls the page fetcher hit and can follow links.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/resolve-unknown-roles.ts --run [--limit 5]    metered, about $0.08 each, capped
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/resolve-unknown-roles.ts --apply
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { PrismaClient, type CrmEligibility } from '@prisma/client'
import { ask, jsonOf, pool, spent } from '../geo/_llm'

const prisma = new PrismaClient()
const STEP = 'resolve-unknown-roles'
const CAP = 25
const OUT = 'data/geo/research/unknown-roles.json'
const arg = (k: string) => process.argv.includes(k)
const limit = (() => { const i = process.argv.indexOf('--limit'); return i >= 0 ? parseInt(process.argv[i + 1], 10) : 0 })()
interface R { role?: 'PRIME' | 'SUB' | 'CUSTOMER' | 'NONE' | 'UNKNOWN'; likelyPrimes?: string | null; eligibilityQuote?: string | null; contactName?: string | null; contactTitle?: string | null; contactEmail?: string | null; contactPhone?: string | null; contactPage?: string | null; nextAction?: string | null; deadline?: string | null; amount?: string | null }

async function run() {
  const leads = await prisma.crmOpportunity.findMany({ where: { pipeline: { key: { in: ['grants', 'fundraising'] } }, nextStep: { startsWith: 'Role: ROLE UNKNOWN' }, url: { not: null } }, select: { id: true, title: true, url: true } })
  const done: Record<string, R> = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {}
  const todo = leads.filter((l) => !done[l.id]).slice(0, limit || undefined)
  console.log(`${leads.length} leads with an unknown role; ${todo.length} to read (about $${(todo.length * 0.08).toFixed(0)}); spent $${spent(STEP).toFixed(2)} of $${CAP}`)
  mkdirSync('data/geo/research', { recursive: true })
  let n = 0
  await pool(todo, 6, async (l) => {
    if (spent(STEP) >= CAP) return
    const prompt = `Open this funding program or solicitation page and, if needed, one or two linked pages on the same site: ${l.url}
Program: ${l.title}
NextChapter is a for-profit job-transition company (AI retraining, career pivots, coaching, layoff support, a workspace for workforce boards, states and universities). Decide what role a for-profit like us could have, from the page's own eligibility words:
PRIME = for-profits may apply directly. SUB = only public bodies, nonprofits, colleges or boards may apply, but a company can join as subrecipient, subcontractor, vendor or technology partner. CUSTOMER = the awardee buys services after award. NONE = not accessible. UNKNOWN only if the page truly does not say.
Return ONE JSON object in a json code block, null where not stated, never guess:
{"role":"PRIME|SUB|CUSTOMER|NONE|UNKNOWN","likelyPrimes":"who the eligible applicants are or recent awardees","eligibilityQuote":"under 30 words from the page","contactName":"","contactTitle":"","contactEmail":"","contactPhone":"","contactPage":"url","nextAction":"one short line","deadline":"YYYY-MM-DD or wording","amount":"as published"}`
    try {
      const r = await ask(STEP, CAP, prompt, { fetches: 3, maxTokens: 1200 })
      const j = jsonOf<R>(r.text)
      if (j) { done[l.id] = j; writeFileSync(OUT, JSON.stringify(done, null, 1)) }
      n++
      if (n % 20 === 0) console.log(`  ${n}/${todo.length} spent $${spent(STEP).toFixed(2)}`)
    } catch (e) { console.log(`  skip ${l.title.slice(0, 50)}: ${(e as Error).message.slice(0, 60)}`) }
  })
  console.log(`done; spent $${spent(STEP).toFixed(2)}`)
}

async function apply() {
  const done: Record<string, R> = JSON.parse(readFileSync(OUT, 'utf8'))
  const ELIG: Record<string, CrmEligibility> = { PRIME: 'FOR_PROFIT_ELIGIBLE', SUB: 'PARTNER_OR_RESEARCH', CUSTOMER: 'NONPROFIT_ONLY', NONE: 'NONPROFIT_ONLY' }
  const LABEL: Record<string, string> = { PRIME: 'PRIME — we can apply directly', SUB: 'SUB — a nonprofit, college or board holds the grant; we join as subrecipient, subcontractor or vendor', CUSTOMER: 'CUSTOMER — the awardee buys; we sell to them after award', NONE: 'NOT ACCESSIBLE', UNKNOWN: 'ROLE UNKNOWN — page does not say' }
  const tally: Record<string, number> = {}
  let n = 0, people = 0
  for (const [id, r] of Object.entries(done)) {
    const role = (r.role ?? 'UNKNOWN').toUpperCase()
    tally[role] = (tally[role] ?? 0) + 1
    const opp = await prisma.crmOpportunity.findUnique({ where: { id }, select: { id: true, orgId: true, nextStep: true, primaryPersonId: true } })
    if (!opp) continue
    const contact = [r.contactName ? `${r.contactName}${r.contactTitle ? `, ${r.contactTitle}` : ''}` : null, r.contactEmail, r.contactPhone, r.contactPage].filter(Boolean).join(' · ')
    const rest = (opp.nextStep ?? '').split('\n').filter((l) => /^Source notes:/.test(l)).join('\n')
    const note = [
      `Role: ${LABEL[role] ?? LABEL.UNKNOWN}${r.likelyPrimes ? `. Likely primes: ${r.likelyPrimes}` : ''}`,
      r.eligibilityQuote ? `Eligibility says: "${r.eligibilityQuote}"` : null,
      `Contact${r.contactName ? '' : ' (office)'}: ${contact || 'none published'} (read by the research API, not checked by hand)`,
      r.nextAction ? `Next: ${r.nextAction}` : null, r.amount ? `Amount: ${r.amount}` : null, r.deadline ? `Deadline: ${r.deadline}` : null, rest || null,
    ].filter(Boolean).join('\n')
    let personId: string | null = null
    if (r.contactName && (r.contactEmail || r.contactPhone) && opp.orgId) {
      const ex = r.contactEmail ? await prisma.crmPerson.findFirst({ where: { email: r.contactEmail.toLowerCase() }, select: { id: true } }) : null
      personId = ex?.id ?? (await prisma.crmPerson.create({ data: { fullName: r.contactName, firstName: r.contactName.split(' ')[0], lastName: r.contactName.split(' ').slice(1).join(' ') || null, email: r.contactEmail?.toLowerCase() ?? null, emails: r.contactEmail ? [r.contactEmail.toLowerCase()] : [], phone: r.contactPhone ?? null, roles: ['GRANTS'], needsCompletion: true, notes: `Program contact, from ${r.contactPage ?? 'the funder page'}.` }, select: { id: true } })).id
      if (!ex) people++
      if (!(await prisma.crmAffiliation.findFirst({ where: { personId, orgId: opp.orgId }, select: { id: true } }))) await prisma.crmAffiliation.create({ data: { personId, orgId: opp.orgId, title: r.contactTitle ?? null } })
    }
    await prisma.crmOpportunity.update({ where: { id }, data: { nextStep: note, ...(ELIG[role] ? { eligibility: ELIG[role] } : {}), ...(personId && !opp.primaryPersonId ? { primaryPersonId: personId } : {}) } })
    n++
  }
  console.log({ updated: n, newPeople: people, roles: tally })
}
if (arg('--run')) run().finally(() => prisma.$disconnect())
else if (arg('--apply')) apply().finally(() => prisma.$disconnect())
else console.log('Use --run [--limit N] or --apply')
