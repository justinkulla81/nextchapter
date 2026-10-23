/**
 * Works out what each faith-based and community nonprofit in the CRM really is. Most arrived as "employer" because
 * someone in our network worked there; many also give grants and issue RFPs (federations, foundations) or run job
 * training and career services on workforce grants (JVS, Catholic Charities, Goodwill, Urban League, YMCA ...).
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/classify-community-orgs.ts --list
 *   npx tsx ... --run [--limit 20]      read each organization's own site (metered, about $0.10 each, capped)
 *   npx tsx ... --apply                 write what was found: roles and website on the organization, the grant programs
 *                                       as funding leads, the career services as candidate-benefit rows, named contacts
 *
 * Results are kept in data/geo/research/community-orgs.json so a stopped run resumes and --apply can be repeated.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs'
import { PrismaClient, type CrmOrgType } from '@prisma/client'
import { ask, jsonOf, pool, spent } from '../geo/_llm'

const prisma = new PrismaClient()
const STEP = 'community-org-roles'
const CAP = 45
const OUT = 'data/geo/research/community-orgs.json'
const arg = (k: string) => process.argv.includes(k)
const num = (k: string) => { const i = process.argv.indexOf(k); return i >= 0 ? parseInt(process.argv[i + 1], 10) : 0 }

const WANT = /(jewish|\bjfs\b|\bjvs\b|\bjevs\b|hias|catholic|lutheran|episcopal|methodist|baptist|presbyterian|salvation army|goodwill|urban league|\bymca\b|\bywca\b|united way|islamic|muslim|mennonite|quaker|interfaith|easterseals|community action|vocational service|family service|social service|refugee|world relief|per scholas|year up|job corps|literacy|community foundation|latino|hispanic|asian american|african american|charities)/i
const SKIP = /(academy|school|seminary|theological|college|university|institute for national|cemeter|hospital|health system|medical|day school|synagogue|temple|church of|congregation|capital$|venture|partners lp|national jewish health|museum|library)/i

const key = (n: string) => n.replace(/\([^)]*\)/g, ' ').toLowerCase().replace(/[^a-z]+/g, ' ').trim().split(' ').slice(0, 5).join(' ')

async function groups() {
  const orgs = await prisma.crmOrganization.findMany({ select: { id: true, name: true, website: true, usState: true, orgTypes: true } })
  const by = new Map<string, typeof orgs>()
  for (const o of orgs) {
    if (!WANT.test(o.name) || SKIP.test(o.name)) continue
    const k = key(o.name)
    if (k.length < 5) continue
    by.set(k, [...(by.get(k) ?? []), o])
  }
  return [...by.entries()].map(([k, list]) => ({ key: k, name: list.map((x) => x.name).sort((a, b) => a.length - b.length)[0], ids: list.map((x) => x.id), website: list.find((x) => x.website)?.website ?? null }))
}

interface Found {
  officialName?: string; website?: string; city?: string; state?: string; whatItDoes?: string
  roles?: string[]; holdsWorkforceContracts?: string | null
  fundingPrograms?: { name: string; url?: string; amount?: string; cycle?: string; whoCanApply?: string; forProfitEligible?: string }[]
  rfpPage?: string | null
  careerServices?: { name: string; url?: string; description?: string; eligibility?: string; openToAllFaiths?: boolean; cost?: string }[]
  contacts?: { name: string; title?: string; email?: string; phone?: string; source?: string }[]
  notes?: string
}

async function run(limit: number) {
  const gs = await groups()
  const done: Record<string, Found & { ids: string[]; at: string }> = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {}
  const todo = gs.filter((g) => !done[g.key]).slice(0, limit || undefined)
  console.log(`${gs.length} organizations in ${gs.length} groups; ${todo.length} to read (about $${(todo.length * 0.1).toFixed(0)}); spent $${spent(STEP).toFixed(2)} of $${CAP}`)
  mkdirSync('data/geo/research', { recursive: true })
  let n = 0
  await pool(todo, 6, async (g) => {
    if (spent(STEP) >= CAP) return
    const prompt = `Find out what this nonprofit really is: "${g.name}"${g.website ? ` (website ${g.website})` : ''}. We only know it from a LinkedIn employer list, so find its own website first (use web search, up to 3 searches), then open its own pages (up to 4 fetches): about, programs, careers/employment services, grants or funding, RFPs or procurement.
NextChapter is a job-transition company. We want to know three things about this organization: (1) does it GIVE grants or issue RFPs to others, (2) does it RUN workforce development, job training or career services (and hold workforce, refugee or state contracts), (3) what career or financial help can an individual job seeker get from it, and is that help open to people of every faith and background.
Return ONE JSON object in a json code block, null for anything you did not find, never guess:
{"officialName":"","website":"https://","city":"","state":"two-letter","whatItDoes":"one sentence",
"roles":["FUNDER","WORKFORCE_PROVIDER","SOCIAL_SERVICE","EMPLOYER_ONLY","EDUCATION","RELIGIOUS","OTHER"],
"holdsWorkforceContracts":"WIOA, state, refugee or other workforce contracts or grants it says it holds, or null",
"fundingPrograms":[{"name":"","url":"","amount":"","cycle":"next deadline or usual window","whoCanApply":"nonprofits only, or anyone","forProfitEligible":"yes|no|unclear"}],
"rfpPage":"url of its procurement or RFP page or null",
"careerServices":[{"name":"","url":"","description":"","eligibility":"","openToAllFaiths":true,"cost":"free or price"}],
"contacts":[{"name":"","title":"","email":"","phone":"","source":"page url"}],
"notes":"anything a salesperson should know"}
Only include roles you saw evidence for. Only list a funding program if the organization itself awards money or issues RFPs to outside parties. Contacts only if the page publishes them.`
    try {
      const r = await ask(STEP, CAP, prompt, { searches: 3, fetches: 4, maxTokens: 3500 })
      const j = jsonOf<Found>(r.text)
      if (j) { done[g.key] = { ...j, ids: g.ids, at: new Date().toISOString() }; writeFileSync(OUT, JSON.stringify(done, null, 1)) }
      n++
      if (n % 10 === 0) console.log(`  ${n}/${todo.length} spent $${spent(STEP).toFixed(2)}`)
    } catch (e) { console.log(`  skip ${g.name}: ${(e as Error).message.slice(0, 80)}`) }
  })
  console.log(`read ${n}; total spent $${spent(STEP).toFixed(2)}`)
}

async function apply() {
  const done: Record<string, Found & { ids: string[] }> = JSON.parse(readFileSync(OUT, 'utf8'))
  const roleCount: Record<string, number> = {}
  const csvRows: string[][] = []
  const benefitRows: string[] = []
  let orgsUpdated = 0, people = 0
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""').replace(/\n/g, ' ')}"`
  for (const g of Object.values(done)) {
    const roles = new Set((g.roles ?? []).map((r) => r.toUpperCase()))
    for (const r of roles) roleCount[r] = (roleCount[r] ?? 0) + 1
    const add: CrmOrgType[] = ['NONPROFIT']
    if (roles.has('FUNDER') || (g.fundingPrograms ?? []).length > 0) add.push('FOUNDATION', 'FUNDER_GRANT')
    if (roles.has('WORKFORCE_PROVIDER')) add.push('WORKFORCE_PROVIDER')
    const note = [g.whatItDoes, g.holdsWorkforceContracts ? `Workforce contracts: ${g.holdsWorkforceContracts}` : null, g.rfpPage ? `RFPs: ${g.rfpPage}` : null, g.notes].filter(Boolean).join('\n')
    const orgs = await prisma.crmOrganization.findMany({ where: { id: { in: g.ids } }, select: { id: true, website: true, usState: true, notes: true, orgTypes: true } })
    for (const o of orgs) {
      await prisma.crmOrganization.update({
        where: { id: o.id },
        data: {
          orgTypes: [...new Set([...o.orgTypes, ...add])],
          ...(o.website ? {} : g.website ? { website: g.website } : {}),
          ...(o.usState || !g.state || g.ids.length > 1 ? {} : { usState: g.state.toUpperCase().slice(0, 2), hqCity: g.city ?? undefined }),
          notes: o.notes?.includes('Workforce contracts') || !note ? o.notes : [o.notes, note].filter(Boolean).join('\n\n'),
        },
      })
      orgsUpdated++
    }
    const orgName = g.officialName ?? ''
    for (const f of g.fundingPrograms ?? []) {
      if (!f.name) continue
      const route = /yes/i.test(f.forProfitEligible ?? '') ? 'DIRECT' : 'PARTNER'
      csvRows.push(['Sweep', '', f.name, orgName, g.state ?? 'U.S.', 'Foundation grant', route === 'DIRECT' ? '7' : '5', f.cycle ?? '', f.amount ?? '', `${route} - ${f.whoCanApply ?? 'eligibility not stated'}${route === 'PARTNER' ? '; a nonprofit-only funder: we reach it through a nonprofit partner or sell to the grantee' : ''}`, f.url ?? g.website ?? '', 'Read on the funder\'s own site 2026-10-23 by the research run; not checked by hand', `${orgName} gives grants or issues RFPs to outside organizations.`, '', ''])
    }
    for (const c of g.careerServices ?? []) {
      if (!c.name || !c.url) continue
      benefitRows.push(`| ${c.name.replace(/\|/g, '/')} | ${orgName.replace(/\|/g, '/')} | ${g.state ?? ''} | ${g.city ?? ''} | ${(c.cost ?? 'See page').replace(/\|/g, '/')} | ${(c.eligibility ?? c.description ?? '').replace(/\|/g, '/').slice(0, 220)}${c.openToAllFaiths === false ? ' (faith-specific)' : ''} | Not stated | ${c.url} | ${c.openToAllFaiths === false ? 'No' : 'Yes'} |`)
    }
    for (const p of g.contacts ?? []) {
      if (!p.name || !(p.email || p.phone) || g.ids.length === 0) continue
      const exists = p.email ? await prisma.crmPerson.findFirst({ where: { email: p.email.toLowerCase() }, select: { id: true } }) : null
      if (exists) continue
      const person = await prisma.crmPerson.create({
        data: { fullName: p.name, firstName: p.name.split(' ')[0], lastName: p.name.split(' ').slice(1).join(' ') || null, email: p.email?.toLowerCase() ?? null, emails: p.email ? [p.email.toLowerCase()] : [], phone: p.phone ?? null, roles: ['GRANTS'], needsCompletion: true, notes: `Published contact for ${orgName}${p.source ? ` (${p.source})` : ''}.` },
        select: { id: true },
      })
      await prisma.crmAffiliation.create({ data: { personId: person.id, orgId: g.ids[0], title: p.title ?? null } })
      people++
    }
  }
  const header = 'Sheet,Rank,Opportunity,Organization,Geography,Funding Type,Score,Deadline / Status,Award Amount,For-Profit Route,Link,Verification,Why it fits,Warm Connection,Connection Title'
  writeFileSync('docs/funding/company-sweep/community_funders.csv', [header, ...csvRows.map((r) => r.map(esc).join(','))].join('\n') + '\n')
  writeFileSync('data/benefits/community_orgs.md', `# Career help from community, faith-based and nonprofit organizations\n\nResearch date: 2026-10-23. Read from each organization's own site by the research run in scripts/crm/classify-community-orgs.ts. Verified = Yes when the program page was opened; a row marked No is faith-specific or unconfirmed.\n\n## Community providers\n| Name | Provider | State | Locality | What it pays | Eligibility | Status | Official URL | Verified? |\n|---|---|---|---|---|---|---|---|---|\n${benefitRows.join('\n')}\n`)
  console.log({ groupsRead: Object.keys(done).length, orgsUpdated, funderPrograms: csvRows.length, careerServices: benefitRows.length, people, roleCount })
}

async function main() {
  if (arg('--list')) { const g = await groups(); console.log(g.length, 'groups,', g.reduce((s, x) => s + x.ids.length, 0), 'organizations'); console.log(g.slice(0, 60).map((x) => `${x.name} (${x.ids.length})`).join('\n')); return }
  if (arg('--run')) return run(num('--limit'))
  if (arg('--apply')) return apply()
  console.log('Use --list, --run [--limit N] or --apply')
}
main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
