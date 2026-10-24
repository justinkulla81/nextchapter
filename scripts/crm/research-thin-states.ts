/**
 * Second pass on the states the first sweep could not read (state sites blocked the fetcher and the search budget ran out):
 * Missouri, North Dakota, Oklahoma, Louisiana, Rhode Island, Delaware. Uses the research API (web search + fetch), four angles per state,
 * and writes docs/funding/company-sweep/thin_states.csv in the same layout the funding importer reads.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/research-thin-states.ts --run     metered, about $0.25 a call, 24 calls, capped at $12
 *   npm run crm:master-list -- --file docs/funding/company-sweep/thin_states.csv --commit               then import
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { ask, jsonOf, pool, spent } from '../geo/_llm'

const STEP = 'thin-states'
const CAP = 12
const OUT = 'data/geo/research/thin-states.json'
const STATES: [string, string][] = [['MO', 'Missouri'], ['ND', 'North Dakota'], ['OK', 'Oklahoma'], ['LA', 'Louisiana'], ['RI', 'Rhode Island'], ['DE', 'Delaware']]
const ANGLES: [string, string][] = [
  ['funds', 'state government funds and programs a for-profit company can apply to for building training, career-change, AI reskilling or workforce technology: workforce innovation and Governor-reserve funds, AI or future-of-work initiatives, SBIR/STTR matching, SSBCI programs, state-funded accelerators, pitch contests and prizes, tax credits, loans'],
  ['rfps', 'open or recurring RFPs, RFQs, procurements and vendor lists for workforce services and technology: the state workforce agency and education department, every local workforce development board in the state (career services, rapid response, AI or digital skills, career exploration, labor market tools), the state procurement portal, and the Eligible Training Provider List'],
  ['partners', 'grants that go to workforce boards, community and technical colleges, universities, chambers, economic development groups and nonprofits where a technology or training company could join as a subrecipient, vendor or partner: state community-college workforce grants, DOL-funded state projects, incumbent-worker and dislocated-worker programs run by the state'],
  ['local', 'local and regional funders open to or useful for a workforce-technology company: community foundations, United Way, city and county innovation or workforce funds, chambers and economic development organizations, venture, angel and impact funds in the state\'s main metros'],
]
const COLS = 'Sheet,Rank,Opportunity,Organization,Geography,Funding Type,Score,Deadline / Status,Award Amount,For-Profit Route,Link,Verification,Why it fits,Warm Connection,Connection Title'

async function main() {
  if (!process.argv.includes('--run')) return console.log('Use --run')
  const done: Record<string, Record<string, string>[]> = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {}
  const jobs = STATES.flatMap(([code, name]) => ANGLES.map(([a, text]) => ({ code, name, a, text }))).filter((j) => !done[`${j.code}-${j.a}`])
  console.log(`${jobs.length} calls to make; spent $${spent(STEP).toFixed(2)} of $${CAP}`)
  await pool(jobs, 4, async (j) => {
    if (spent(STEP) >= CAP) return
    const prompt = `Find real, current opportunities in ${j.name} for NextChapter, a for-profit job-transition company (AI retraining and career-pivot courses, coaching, layoff support, a participant workspace for workforce boards, colleges and states).
Look for: ${j.text}.
Use web search (up to 6 searches) and open the program's own page (up to 3 fetches). Return up to 12 distinct programs as ONE JSON array in a json code block. Each item:
{"Opportunity":"program or RFP name","Organization":"funder or issuing body, full name","Geography":"${j.code} or city, ${j.code}","Funding Type":"Grant | RFP / procurement | Contest / prize | Accelerator | Venture / impact fund | SBIR / STTR | Loan / credit | Tax credit | Partner-route grant | Foundation grant | ETPL listing","Deadline / Status":"YYYY-MM-DD if published, else the wording (rolling, annual, closed with date)","Award Amount":"as published","For-Profit Route":"DIRECT|PARTNER|NONPROFIT-ONLY|UNKNOWN - the page's eligibility words","Link":"the program's own https page","Verification":"Verified 2026-10-23 on funder page if you opened it, otherwise Unverified (search result)","Why it fits":"one sentence","Warm Connection":"named contact if the page publishes one, with email or phone","Connection Title":""}
Never invent a program, amount, date or contact. Skip anything with no real page.`
    try {
      const r = await ask(STEP, CAP, prompt, { searches: 6, fetches: 3, maxTokens: 5000 })
      const rows = jsonOf<Record<string, string>[]>(r.text) ?? []
      done[`${j.code}-${j.a}`] = rows.filter((x) => x?.Opportunity && /^https?:/.test(x.Link ?? ''))
      writeFileSync(OUT, JSON.stringify(done, null, 1))
      console.log(`  ${j.code} ${j.a}: ${done[`${j.code}-${j.a}`].length} rows ($${r.cost.toFixed(2)}, total $${spent(STEP).toFixed(2)})`)
    } catch (e) { console.log(`  skip ${j.code} ${j.a}: ${(e as Error).message.slice(0, 60)}`) }
  })
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""').replace(/\n/g, ' ')}"`
  const rows = Object.values(done).flat()
  const score = (r: Record<string, string>) => (/^DIRECT/i.test(r['For-Profit Route'] ?? '') ? '7' : /^PARTNER/i.test(r['For-Profit Route'] ?? '') ? '5' : '4')
  writeFileSync('docs/funding/company-sweep/thin_states.csv', [COLS, ...rows.map((r) => ['Sweep', '', r.Opportunity, r.Organization, r.Geography, r['Funding Type'], score(r), r['Deadline / Status'], r['Award Amount'], r['For-Profit Route'], r.Link, r.Verification, r['Why it fits'], r['Warm Connection'], r['Connection Title']].map(esc).join(','))].join('\n') + '\n')
  console.log(`wrote ${rows.length} rows; spent $${spent(STEP).toFixed(2)}`)
}
main().catch((e) => { console.error(e); process.exit(1) })
