/**
 * Builds out the Competitors page across every market near ours: finds the companies in each category on the web,
 * reads each one's site with the same reader the "Add from website" button uses, and files a draft card.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/vision/research-landscape.ts               plan only, no spend
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/vision/research-landscape.ts --discover    find candidates (about $0.15 a category)
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/vision/research-landscape.ts --enrich      read each site (about $0.10 each) and file the cards
 *   add --only failed,coaching to run some categories; --refresh-existing re-reads the cards already there
 *
 * Metered: Claude Haiku with web search and web fetch. Every call is added to data/geo/research/cost-ledger.jsonl and the run
 * stops at CAP dollars for the step "competitor-landscape". Nothing is overwritten; a company already on the page is skipped.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { ask, jsonOf, pool, spent } from '../geo/_llm'
import { enrichCompetitor } from '../../src/lib/vision/competitor-enrich'
import { hostOf, homepageOf } from '../../src/lib/vision/competitor-areas'

const prisma = new PrismaClient()
const STEP = 'competitor-landscape'
const CAP = 60
const LEDGER = 'data/geo/research/cost-ledger.jsonl'
const CAND = 'data/geo/research/landscape-candidates.json'
const arg = (k: string) => process.argv.includes(k)
const only = (() => { const i = process.argv.indexOf('--only'); return i >= 0 ? process.argv[i + 1].split(',') : null })()

interface Cat { key: string; label: string; n: number; ask: string; seed?: string[] }
const CATS: Cat[] = [
  { key: 'job_transition', label: 'Job transition and career-change platforms', n: 20, ask: 'companies and platforms that help laid-off, between-jobs or career-changing professionals move to their next role, paid by the individual or by an employer (not only outplacement firms)' },
  { key: 'outplacement', label: 'Outplacement and career transition services', n: 25, ask: 'US outplacement and career-transition service providers paid by employers, including boutique, regional and executive outplacement firms and tech-led newcomers', seed: ['DBM Global', 'Right Management', 'Challenger, Gray & Christmas', 'Manchester Partners', 'Career Partners International', 'Korn Ferry career transition'] },
  { key: 'coaching', label: 'Coaching platforms and marketplaces', n: 20, ask: 'career coaching, executive coaching and leadership coaching platforms and marketplaces (individual and employer-paid)' },
  { key: 'career_exploration', label: 'Career exploration, assessment and pivot platforms', n: 15, ask: 'platforms for exploring careers, matching skills to new roles and planning a career pivot, consumer or government-sold' },
  { key: 'higher_ed', label: 'Higher-ed alumni, career and executive-education tools', n: 25, ask: 'software and services sold to colleges and universities for alumni engagement, career services, career development, employer relations, mentoring and executive education' },
  { key: 'recruiter_crm', label: 'Recruiter CRMs and ATS for agencies and search firms', n: 20, ask: 'recruiter CRM, applicant tracking and candidate sourcing tools used by staffing agencies, executive search firms and in-house recruiters' },
  { key: 'retention', label: 'Employee retention, engagement and internal mobility', n: 20, ask: 'employee retention, engagement, internal talent marketplace, career pathing and internal mobility tools sold to employers' },
  { key: 'job_boards', label: 'Job boards and hiring tools', n: 25, ask: 'job boards, job aggregators, applicant tracking systems and recruiting marketing tools, general and professional-level' },
  { key: 'assessments', label: 'Assessments and reference checking', n: 20, ask: 'pre-hire and career assessments, skills tests, personality and strengths assessments, and reference-checking tools' },
  { key: 'networking', label: 'Career networking and mentoring tools', n: 20, ask: 'professional networking, informational-interview, mentoring and relationship-management tools for job seekers and professionals' },
  { key: 'job_search_tools', label: 'Resume, tracking, auto-apply and interview tools', n: 25, ask: 'resume builders, job application trackers, AI auto-apply tools, cover-letter and interview-practice tools for job seekers' },
  { key: 'job_data', label: 'Employee and job data companies', n: 20, ask: 'labor market data, job posting data, workforce analytics, people data, salary and compensation data providers' },
  { key: 'early_career', label: 'Early-career and entry-level platforms', n: 15, ask: 'platforms serving students, new graduates and entry-level talent: internships, early-career jobs, micro-internships, mentoring' },
  { key: 'retraining', label: 'Retraining, reskilling and bootcamp providers', n: 25, ask: 'retraining, reskilling, upskilling and bootcamp providers for adults changing careers, including nonprofits and employer-paid programs' },
  { key: 'older_workers', label: 'Older workers, returners and 50+ job seekers', n: 12, ask: 'job boards, programs and services for workers over 50, returning-to-work (returnship) programs and encore careers' },
  { key: 'fractional_gig', label: 'Fractional, consulting and gig marketplaces', n: 15, ask: 'marketplaces and agencies for fractional executives, independent consultants and professional gig work' },
  { key: 'community', label: 'Support communities and layoff support', n: 10, ask: 'communities, peer groups and services supporting people who were laid off or are out of work' },
  { key: 'workforce_gov', label: 'Vendors to workforce agencies and boards', n: 20, ask: 'vendors selling to state workforce agencies, local workforce boards and American Job Centers: case management, labor exchange, career navigation, AI career tools, labor market information' },
  { key: 'nonprofit_providers', label: 'Nonprofit and faith-based career-service providers', n: 40, ask: 'nonprofit, community and faith-based organizations that run career counseling, job placement and job-training programs and hold workforce grants or contracts: Jewish Vocational Service and Jewish Family Services agencies, Catholic Charities agencies, Lutheran Services, Goodwill, Urban League affiliates, YMCA, Salvation Army, Easterseals, Per Scholas, Year Up, HIAS, Upwardly Global and similar. Name the biggest or most representative ones, and say whether they hold WIOA or state workforce contracts', seed: ['JVS Boston', 'JEVS Human Services', 'Catholic Charities USA', 'Lutheran Services in America', 'Goodwill Industries International', 'National Urban League', 'Upwardly Global', 'Per Scholas', 'Year Up'] },
  { key: 'failed_2', label: 'Failed, shut down or distressed companies', n: 30, ask: 'coding bootcamps, online-learning, reskilling and edtech companies that shut down, went bankrupt or were sold in distress between 2021 and 2026 (for example after enrollment collapses, income-share-agreement troubles or funding drying up); say what happened and why' },
  { key: 'failed_3', label: 'Failed, shut down or distressed companies', n: 30, ask: 'recruiting, job-search, hiring-marketplace, coaching and career-network startups and job boards that shut down, were acquired for parts, went bankrupt or lost most of their business between 2021 and 2026; say what happened and why' },
  { key: 'nonprofit_providers_2', label: 'Nonprofit and faith-based career-service providers', n: 30, ask: 'Jewish Vocational Service (JVS), JEVS, Jewish Family Service and Jewish Community agencies across the United States that run career counseling, job placement, training or refugee employment programs' },
  { key: 'nonprofit_providers_3', label: 'Nonprofit and faith-based career-service providers', n: 30, ask: 'Catholic Charities agencies, Lutheran Social Services, Goodwill affiliates, Urban League affiliates, YMCAs and Salvation Army units that run workforce programs and hold workforce grants, one representative per region' },
  { key: 'workforce_gov_2', label: 'Vendors to workforce agencies and boards', n: 20, ask: 'technology and service vendors that win contracts from state workforce agencies and local workforce boards: job banks, career pathway and navigation tools, rapid response and layoff tools, labor market information, WIOA case management' },
  { key: 'failed', label: 'Failed, shut down or distressed companies', n: 30, ask: 'companies in careers, jobs, hiring, recruiting, edtech, coaching and bootcamps that shut down, went bankrupt, were sold in distress or visibly collapsed (mass layoffs, down rounds, lost most customers) between 2021 and 2026; say what happened' },
]

function ledger(step: string, cost: number, extra: object) { mkdirSync('data/geo/research', { recursive: true }); appendFileSync(LEDGER, JSON.stringify({ at: new Date().toISOString(), step, cost, ...extra }) + '\n') }

async function discover(known: Set<string>) {
  const found: Record<string, { name: string; url: string; note: string }[]> = existsSync(CAND) ? JSON.parse(readFileSync(CAND, 'utf8')) : {}
  for (const c of CATS.filter((x) => !only || only.includes(x.key))) {
    if (found[c.key]) { console.log(`  have ${c.key}: ${found[c.key].length}`); continue }
    if (spent(STEP) >= CAP) { console.log('cap reached'); break }
    const prompt = `List up to ${c.n} real, notable companies in this market: ${c.ask}.
Use web search (up to 4 searches). Cover the well-known names AND smaller or newer ones. Prefer companies that serve the United States.
${c.seed ? `Include these if they exist: ${c.seed.join('; ')}.\n` : ''}Skip these, we already track them: ${[...known].slice(0, 80).join(', ')}.
Return ONE JSON array in a json code block: [{"name":"","url":"https://homepage","note":"one line: what it does and, if relevant, what happened to it"}]. Only include a company if you saw its real website. No duplicates.`
    try {
      const r = await ask(STEP, CAP, prompt, { searches: 4, maxTokens: 4000 })
      const list = (jsonOf<{ name: string; url: string; note: string }[]>(r.text) ?? []).filter((x) => x?.name && homepageOf(x.url ?? ''))
      found[c.key] = list.map((x) => ({ name: String(x.name).trim(), url: homepageOf(x.url)!, note: String(x.note ?? '').slice(0, 240) }))
      writeFileSync(CAND, JSON.stringify(found, null, 1))
      console.log(`  ${c.key}: ${found[c.key].length} found  ($${r.cost.toFixed(3)}, total $${spent(STEP).toFixed(2)})`)
    } catch (e) { console.log(`  ${c.key}: failed ${(e as Error).message}`) }
  }
  return found
}

async function main() {
  const existing = await prisma.productCompetitor.findMany({ select: { id: true, name: true, url: true } })
  const known = new Set(existing.map((e) => e.name))
  const hosts = new Set(existing.map((e) => (e.url ? hostOf(e.url) : null)).filter(Boolean) as string[])
  console.log(`tracked ${existing.length}; categories ${CATS.length}; spent so far $${spent(STEP).toFixed(2)} of $${CAP}`)
  if (!arg('--discover') && !arg('--enrich')) { for (const c of CATS) console.log(`  ${c.key.padEnd(20)} up to ${c.n}`); console.log('\nPlan only. Add --discover, then --enrich.'); return }
  const found = arg('--discover') ? await discover(known) : (existsSync(CAND) ? JSON.parse(readFileSync(CAND, 'utf8')) : {})
  if (!arg('--enrich')) return
  const todo: { cat: Cat; name: string; url: string; note: string }[] = []
  const seen = new Set(hosts)
  for (const c of CATS.filter((x) => !only || only.includes(x.key))) for (const x of found[c.key] ?? []) {
    const h = hostOf(x.url); if (!h || seen.has(h)) continue
    seen.add(h); todo.push({ cat: c, ...x })
  }
  console.log(`to read: ${todo.length} new companies (about $${(todo.length * 0.1).toFixed(0)})`)
  let done = 0, failed = 0
  await pool(todo, 8, async (t) => {
    if (spent(STEP) >= CAP) return
    try {
      const { data, cost, searches } = await enrichCompetitor(t.url, `${t.cat.label}. ${t.note}`)
      ledger(STEP, cost, { kind: 'enrich', url: t.url, searches })
      const taken = known.has(data.name)
      await prisma.productCompetitor.create({
        data: {
          name: taken ? `${data.name} (${hostOf(t.url)})` : data.name, url: t.url, segment: data.segment, positioning: data.positioning,
          relationship: data.relationship, areas: data.areas, keyFeatures: data.keyFeatures,
          customers: data.customers as unknown as object, wins: data.wins as unknown as object,
          weWin: data.weWin, theyWin: data.theyWin, weNeed: data.weNeed, pricingNote: data.pricingNote, foundedYear: data.foundedYear, hq: data.hq,
          lastRound: data.lastRound, investors: data.investors, fundingRaisedUsd: data.fundingRaisedUsd && data.fundingRaisedUsd <= 2_147_483_647 ? data.fundingRaisedUsd : null,
          headcount: data.headcount, revenueNote: data.revenueNote, userCountNote: data.userCountNote, sourceUrl: data.sourceUrl, notes: data.notes,
          status: data.status, statusNote: data.statusNote, lessons: data.lessons, partnerIdea: data.partnerIdea, category: t.cat.key.replace(/_\d+$/, ''),
          filledBy: 'research', needsReview: true, lastReviewedAt: new Date(),
        },
      })
      known.add(data.name)
      done++
    } catch (e) { failed++; console.log(`  skip ${t.name}: ${(e as Error).message.slice(0, 80)}`) }
    if ((done + failed) % 10 === 0) console.log(`  ${done + failed}/${todo.length}  spent $${spent(STEP).toFixed(2)}`)
  })
  console.log(`filed ${done}, failed ${failed}, total spent $${spent(STEP).toFixed(2)}`)
}
main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
