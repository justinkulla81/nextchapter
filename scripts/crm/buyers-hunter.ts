/**
 * People at the organizations that buy, fund, refer or advise on help for laid-off white-collar
 * workers, outside the employers and agencies the layoff notices lead to: professional
 * associations, white-collar and federal-employee unions, the national workforce and government
 * associations, restructuring advisers, benefits and employee-assistance firms, career-transition
 * nonprofits, funders, career-pivot learning companies and outplacement firms.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/buyers-hunter.ts search <out.json>
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/buyers-hunter.ts import <out.json> [--apply]
 *
 * One Hunter Domain Search per organization (about 100 in all). The domains are listed by hand;
 * one that Hunter does not know simply returns nobody, at no cost. Senior people with a title
 * about partnerships, workforce, careers, talent, members, programs or leadership are kept, up
 * to three per organization. A valid address becomes the email; a confident one is a guess.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import type { CrmPersonRole } from '@prisma/client'
import { prisma } from '../../src/lib/prisma'
import { addContactToCrm, ensureOrg } from '../../src/lib/crm/add-contact'
import { goalsForRoles } from '../../src/lib/crm/goals'

const KEY = process.env.HUNTER_API_KEY
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Cat = 'association' | 'union' | 'gov_association' | 'restructuring' | 'benefits' | 'career_nonprofit' | 'funder' | 'pivot_learning' | 'outplacement' | 'research' | 'career_dev' | 'policy_assoc'
const CAT: Record<Cat, { label: string; orgType: string; role: CrmPersonRole }> = {
  association: { label: 'professional association', orgType: 'NONPROFIT', role: 'BD_PARTNER' },
  union: { label: 'union', orgType: 'NONPROFIT', role: 'BD_PARTNER' },
  gov_association: { label: 'government and workforce association', orgType: 'NONPROFIT', role: 'BD_PARTNER' },
  restructuring: { label: 'restructuring adviser', orgType: 'VENDOR', role: 'ADVISOR' },
  benefits: { label: 'benefits, employee assistance or payroll firm', orgType: 'VENDOR', role: 'ADVISOR' },
  career_nonprofit: { label: 'career-transition nonprofit', orgType: 'NONPROFIT', role: 'BD_PARTNER' },
  funder: { label: 'funder', orgType: 'FOUNDATION', role: 'GRANTS' },
  pivot_learning: { label: 'career-pivot learning company', orgType: 'VENDOR', role: 'GTM_PARTNER' },
  outplacement: { label: 'outplacement firm', orgType: 'OUTPLACEMENT_FIRM', role: 'BD_PARTNER' },
  research: { label: 'research or policy organization on work, unemployment and AI displacement', orgType: 'THINK_TANK', role: 'POLICY_ANALYST' },
  career_dev: { label: 'career-development, career-exploration or talent-skills organization', orgType: 'VENDOR', role: 'BD_PARTNER' },
  policy_assoc: { label: 'association of state legislators, governments or workforce professionals', orgType: 'NONPROFIT', role: 'BD_PARTNER' },
}

const ORGS: [string, string, Cat][] = [
  // Professional associations with white-collar members
  ['SHRM', 'shrm.org', 'association'], ['Project Management Institute', 'pmi.org', 'association'], ['AICPA & CIMA', 'aicpa-cima.com', 'association'],
  ['American Bar Association', 'americanbar.org', 'association'], ['IEEE', 'ieee.org', 'association'], ['ACM', 'acm.org', 'association'],
  ['American Management Association', 'amanet.org', 'association'], ['Association for Talent Development', 'td.org', 'association'], ['WorldatWork', 'worldatwork.org', 'association'],
  ['American Marketing Association', 'ama.org', 'association'], ['CFA Institute', 'cfainstitute.org', 'association'], ['Institute of Management Accountants', 'imanet.org', 'association'],
  ['Financial Planning Association', 'onefpa.org', 'association'], ['American Staffing Association', 'americanstaffing.org', 'association'], ['National Career Development Association', 'ncda.org', 'association'],
  ['ASAE', 'asaecenter.org', 'association'], ['ISACA', 'isaca.org', 'association'], ['ISC2', 'isc2.org', 'association'], ['CompTIA', 'comptia.org', 'association'],
  ['Society of Women Engineers', 'swe.org', 'association'], ['National Society of Black Engineers', 'nsbe.org', 'association'], ['Ellevate Network', 'ellevatenetwork.com', 'association'],
  ['Chief', 'chief.com', 'association'], ['ExecuNet', 'execunet.com', 'association'], ['AARP', 'aarp.org', 'association'], ['AARP Foundation', 'aarpfoundation.org', 'association'],
  ['International Association of Administrative Professionals', 'iaap-hq.org', 'association'], ['Society for Human Resource Management Foundation', 'shrmfoundation.org', 'association'],
  // Unions with white-collar, professional or federal members
  ['IFPTE', 'ifpte.org', 'union'], ['Communications Workers of America', 'cwa-union.org', 'union'], ['AFGE', 'afge.org', 'union'], ['NTEU', 'nteu.org', 'union'],
  ['NFFE', 'nffe.org', 'union'], ['AFL-CIO', 'aflcio.org', 'union'], ['SPEEA', 'speea.org', 'union'], ['SEIU', 'seiu.org', 'union'], ['AFSCME', 'afscme.org', 'union'],
  ['Federal Managers Association', 'fedmanagers.org', 'union'], ['Senior Executives Association', 'seniorexecs.org', 'union'], ['Partnership for Public Service', 'ourpublicservice.org', 'union'],
  // National associations of the people who run government and workforce programs
  ['NASWA', 'naswa.org', 'gov_association'], ['National Association of Workforce Boards', 'nawb.org', 'gov_association'], ['National Governors Association', 'nga.org', 'gov_association'],
  ['National Association of Counties', 'naco.org', 'gov_association'], ['National League of Cities', 'nlc.org', 'gov_association'], ['ICMA', 'icma.org', 'gov_association'],
  ['U.S. Conference of Mayors', 'usmayors.org', 'gov_association'], ['National Skills Coalition', 'nationalskillscoalition.org', 'gov_association'], ['Jobs for the Future', 'jff.org', 'gov_association'],
  ['America\'s Small Business Development Centers', 'americassbdc.org', 'gov_association'], ['SCORE', 'score.org', 'gov_association'], ['Council for Adult and Experiential Learning', 'cael.org', 'gov_association'],
  ['National Association of Development Organizations', 'nado.org', 'gov_association'], ['International Economic Development Council', 'iedconline.org', 'gov_association'], ['American Library Association', 'ala.org', 'gov_association'],
  // Restructuring and workforce advisers
  ['AlixPartners', 'alixpartners.com', 'restructuring'], ['FTI Consulting', 'fticonsulting.com', 'restructuring'], ['Alvarez & Marsal', 'alvarezandmarsal.com', 'restructuring'],
  ['Kroll', 'kroll.com', 'restructuring'], ['Huron', 'huronconsultinggroup.com', 'restructuring'], ['Berkeley Research Group', 'thinkbrg.com', 'restructuring'], ['Ankura', 'ankura.com', 'restructuring'],
  // Benefits, employee assistance and payroll firms that sit next to a layoff
  ['Mercer', 'mercer.com', 'benefits'], ['WTW', 'wtwco.com', 'benefits'], ['Aon', 'aon.com', 'benefits'], ['Segal', 'segalco.com', 'benefits'], ['Gallagher', 'ajg.com', 'benefits'],
  ['Lockton', 'lockton.com', 'benefits'], ['Marsh McLennan Agency', 'marshmma.com', 'benefits'], ['Alight', 'alight.com', 'benefits'], ['Lyra Health', 'lyrahealth.com', 'benefits'],
  ['Spring Health', 'springhealth.com', 'benefits'], ['ComPsych', 'compsych.com', 'benefits'], ['TriNet', 'trinet.com', 'benefits'], ['Insperity', 'insperity.com', 'benefits'],
  ['Justworks', 'justworks.com', 'benefits'], ['Financial Finesse', 'financialfinesse.com', 'benefits'],
  // Career-transition nonprofits and community organizations
  ['Goodwill Industries International', 'goodwill.org', 'career_nonprofit'], ['Per Scholas', 'perscholas.org', 'career_nonprofit'], ['Year Up', 'yearup.org', 'career_nonprofit'],
  ['Opportunity@Work', 'opportunityatwork.org', 'career_nonprofit'], ['United Way Worldwide', 'unitedway.org', 'career_nonprofit'], ['Jobs for Life', 'jobsforlife.org', 'career_nonprofit'],
  ['Upwardly Global', 'upwardlyglobal.org', 'career_nonprofit'], ['Dress for Success', 'dressforsuccess.org', 'career_nonprofit'], ['Workforce Development Council of Seattle-King County', 'seakingwdc.org', 'career_nonprofit'],
  // Funders of workforce and career-transition work
  ['Lumina Foundation', 'luminafoundation.org', 'funder'], ['Walmart Foundation', 'walmart.org', 'funder'], ['Strada Education Foundation', 'stradaeducation.org', 'funder'],
  ['Markle Foundation', 'markle.org', 'funder'], ['Ascendium Education Group', 'ascendium.org', 'funder'], ['Joyce Foundation', 'joycefdn.org', 'funder'], ['Google.org', 'google.org', 'funder'],
  ['JPMorgan Chase Foundation', 'jpmorganchase.com', 'funder'], ['Bank of America Charitable Foundation', 'bankofamerica.com', 'funder'], ['Ballmer Group', 'ballmergroup.org', 'funder'],
  ['Annie E. Casey Foundation', 'aecf.org', 'funder'], ['W.K. Kellogg Foundation', 'wkkf.org', 'funder'], ['Gates Foundation', 'gatesfoundation.org', 'funder'], ['Charles Koch Foundation', 'charleskochfoundation.org', 'funder'],
  // Career-pivot learning companies
  ['General Assembly', 'generalassemb.ly', 'pivot_learning'], ['Springboard', 'springboard.com', 'pivot_learning'], ['Coursera', 'coursera.org', 'pivot_learning'],
  ['Multiverse', 'multiverse.io', 'pivot_learning'], ['Guild', 'guild.com', 'pivot_learning'], ['2U', '2u.com', 'pivot_learning'], ['Career Karma', 'careerkarma.com', 'pivot_learning'],
  ['Fullstack Academy', 'fullstackacademy.com', 'pivot_learning'], ['Flatiron School', 'flatironschool.com', 'pivot_learning'], ['Udacity', 'udacity.com', 'pivot_learning'],
  // Outplacement firms (partners and competitors)
  ['Careerminds', 'careerminds.com', 'outplacement'], ['LHH', 'lhh.com', 'outplacement'], ['Randstad RiseSmart', 'randstadrisesmart.com', 'outplacement'], ['INTOO', 'intoo.com', 'outplacement'],
  ['Right Management', 'right.com', 'outplacement'], ['Korn Ferry', 'kornferry.com', 'outplacement'], ['Challenger, Gray & Christmas', 'challengergray.com', 'outplacement'], ['FutureFit AI', 'futurefit.ai', 'outplacement'],
]

// BUYERS_SET=2: research and policy organizations (AI displacement, unemployment insurance, white-collar work), career-development
// and career-exploration organizations, and associations of legislators and workforce professionals.
const ORGS_2: [string, string, Cat][] = [
  ['Brookings Institution', 'brookings.edu', 'research'], ['Urban Institute', 'urban.org', 'research'], ['Economic Policy Institute', 'epi.org', 'research'],
  ['Center on Budget and Policy Priorities', 'cbpp.org', 'research'], ['National Employment Law Project', 'nelp.org', 'research'], ['The Century Foundation', 'tcf.org', 'research'],
  ['W.E. Upjohn Institute', 'upjohn.org', 'research'], ['New America', 'newamerica.org', 'research'], ['Aspen Institute', 'aspeninstitute.org', 'research'],
  ['Burning Glass Institute', 'burningglassinstitute.org', 'research'], ['Lightcast', 'lightcast.io', 'research'], ['World Economic Forum', 'weforum.org', 'research'],
  ['The Conference Board', 'conference-board.org', 'research'], ['Center for American Progress', 'americanprogress.org', 'research'], ['AI Now Institute', 'ainowinstitute.org', 'research'],
  ['Partnership on AI', 'partnershiponai.org', 'research'], ['Roosevelt Institute', 'rooseveltinstitute.org', 'research'], ['Economic Innovation Group', 'eig.org', 'research'],
  ['Opportunity America', 'opportunityamericaonline.org', 'research'], ['National Fund for Workforce Solutions', 'nfwsolutions.org', 'research'], ['Bipartisan Policy Center', 'bipartisanpolicy.org', 'research'],
  ['Third Way', 'thirdway.org', 'research'], ['Progressive Policy Institute', 'progressivepolicy.org', 'research'], ['American Enterprise Institute', 'aei.org', 'research'],
  ['Federal Reserve Bank of Atlanta', 'atlantafed.org', 'research'], ['Federal Reserve Bank of St. Louis', 'stlouisfed.org', 'research'], ['Federal Reserve Bank of Minneapolis', 'minneapolisfed.org', 'research'],
  ['Federal Reserve Bank of Cleveland', 'clevelandfed.org', 'research'], ['Federal Reserve Bank of New York', 'newyorkfed.org', 'research'], ['Federal Reserve Bank of Boston', 'bostonfed.org', 'research'],
  ['Federal Reserve Bank of Philadelphia', 'philadelphiafed.org', 'research'], ['Federal Reserve Bank of Kansas City', 'kansascityfed.org', 'research'], ['Federal Reserve Bank of Richmond', 'richmondfed.org', 'research'],
  ['Federal Reserve Bank of Dallas', 'dallasfed.org', 'research'], ['Federal Reserve Bank of Chicago', 'chicagofed.org', 'research'], ['Federal Reserve Bank of San Francisco', 'frbsf.org', 'research'],
  ['Indeed Hiring Lab', 'hiringlab.org', 'research'], ['Revelio Labs', 'reveliolabs.com', 'research'], ['ADP Research', 'adpresearch.com', 'research'],
  ['National Conference of State Legislatures', 'ncsl.org', 'policy_assoc'], ['Council of State Governments', 'csg.org', 'policy_assoc'], ['National Association of Workforce Development Professionals', 'nawdp.org', 'policy_assoc'],
  ['NACE', 'naceweb.org', 'career_dev'], ['Career Thought Leaders', 'careerthoughtleaders.com', 'career_dev'], ['Professional Association of Resume Writers and Career Coaches', 'parw.com', 'career_dev'],
  ['International Coaching Federation', 'coachingfederation.org', 'career_dev'], ['SIOP', 'siop.org', 'career_dev'], ['Training Industry', 'trainingindustry.com', 'career_dev'],
  ['Degreed', 'degreed.com', 'career_dev'], ['Eightfold AI', 'eightfold.ai', 'career_dev'], ['Gloat', 'gloat.com', 'career_dev'], ['Fuel50', 'fuel50.com', 'career_dev'],
  ['Pluralsight', 'pluralsight.com', 'career_dev'], ['edX', 'edx.org', 'career_dev'], ['Udemy', 'udemy.com', 'career_dev'], ['Handshake', 'joinhandshake.com', 'career_dev'],
  ['Teal', 'tealhq.com', 'career_dev'], ['The Ladders', 'theladders.com', 'career_dev'], ['Upwork', 'upwork.com', 'career_dev'], ['Cornerstone OnDemand', 'cornerstoneondemand.com', 'career_dev'],
  ['Skillsoft', 'skillsoft.com', 'career_dev'], ['Chief Learning Officer', 'clomedia.com', 'career_dev'], ['Association for Career and Technical Education', 'acteonline.org', 'career_dev'],
  ['American Counseling Association', 'counseling.org', 'career_dev'], ['National Board for Certified Counselors', 'nbcc.org', 'career_dev'],
]
const SET = process.env.BUYERS_SET === '2' ? ORGS_2 : ORGS
const RESEARCH = /economist|research|fellow|labor|workforce|employment|unemployment|future of work|policy|insurance|program|director|president|executive|head of|lead\b/i
const RESEARCH_BAD = /communications|media|fundrais|finance|legal|marketing|events|operations|development director|human resources|assistant/i
const TITLE = /partnership|alliance|business development|workforce|career|talent|transition|member|program|strategy|innovation|executive director|president|ceo|chief executive|managing director|head of|vice president|\bvp\b|director|chief (people|human|strategy|operating|growth|revenue|impact)|grant|philanthrop|community|impact|public sector|government|learning|education/i
const BAD = /sales (rep|associate|development rep)|account executive|engineer|developer|recruiter|intern|assistant|paralegal|software|designer|analyst|accountant|counsel|attorney/i
// At import, narrower than the search: a leader, or someone whose work is partnerships, workforce, careers, programs or strategy,
// and not finance, legal, marketing, policy, operations or technology.
const EXEC = /executive director|(?<!vice )(?<!svp )president|\bceo\b|chief executive|managing director|founder/i
const REL = /partnership|alliance|business development|workforce|career|talent|transition|member|program|strategy|innovation|chief (strategy|impact|growth|people|human)|public sector|government|community|impact|philanthrop|grant|learning|education/i
const NOT = /finance|financial|legislative|marketing|content|sustainab|legal|counsel|\bit\b|technolog|security|communicat|public affairs|policy|risk|audit|tax|account|operations|procurement|real estate|facilit|editor|publish|research/i
const relevant = (t: string, cat?: Cat) => cat === 'research'
  ? EXEC.test(t) || (/economist|research|fellow|labor|workforce|employment|unemployment|future of work|policy|insurance|program/i.test(t) && !RESEARCH_BAD.test(t))
  : EXEC.test(t) || (REL.test(t) && !NOT.test(t))
const score = (t: string) => /executive director|president|ceo|chief executive|managing director/i.test(t) ? 0 : /partnership|alliance|business development|workforce|career|talent|transition|public sector|government/i.test(t) ? 1 : /director|vice president|\bvp\b|head of/i.test(t) ? 2 : 3

async function hunter(path: string, params: Record<string, string>): Promise<any> {
  const qs = new URLSearchParams({ ...params, api_key: KEY! })
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`https://api.hunter.io/v2/${path}?${qs}`, { signal: AbortSignal.timeout(30_000) }).catch(() => null)
    if (!res) { await sleep(3000); continue }
    if (res.status === 429 || res.status === 202) { await sleep(6000 * (attempt + 1)); continue }
    if (res.status === 401 || res.status === 403) throw new Error(`Hunter refused the request (${res.status})`)
    return res.json().catch(() => null)
  }
  return null
}

interface Hit { name: string; title: string; email: string; confidence: number; status: string | null; linkedin: string | null }
interface Row { org: string; domain: string; cat: Cat; found: number; hits: Hit[] }

async function search(out: string) {
  if (!KEY) throw new Error('HUNTER_API_KEY is not set')
  const queue = [...SET]
  const rows: Row[] = []
  const worker = async () => {
    for (let o = queue.shift(); o; o = queue.shift()) {
      const j = await hunter('domain-search', { domain: o[1], limit: '10', seniority: 'senior,executive', type: 'personal' }).catch(() => null)
      const emails: any[] = j?.data?.emails ?? []
      const hits = emails
        .filter((e) => e.first_name && e.last_name && e.position && (o[2] === 'research' ? RESEARCH.test(e.position) && !RESEARCH_BAD.test(e.position) : TITLE.test(e.position) && !BAD.test(e.position)) && (e.confidence ?? 0) >= 70)
        .sort((a, b) => score(a.position) - score(b.position) || (b.confidence ?? 0) - (a.confidence ?? 0))
        .slice(0, o[2] === 'research' ? 4 : 3)
        .map((e) => ({ name: `${e.first_name} ${e.last_name}`, title: e.position, email: e.value, confidence: e.confidence, status: e.verification?.status ?? null, linkedin: e.linkedin ?? null }))
      rows.push({ org: o[0], domain: o[1], cat: o[2], found: emails.length, hits })
      await sleep(250)
    }
  }
  await Promise.all(Array.from({ length: 3 }, worker))
  writeFileSync(out, JSON.stringify(rows, null, 1))
  console.log(`done: ${rows.length} organizations, ${rows.filter((r) => r.hits.length).length} with a contact, ${rows.reduce((s, r) => s + r.hits.length, 0)} people. Saved ${out}`)
  const rq = (await hunter('account', {}))?.data?.requests
  if (rq) console.log(`Hunter left: ${rq.searches?.remaining} searches, ${rq.verifications?.remaining} verifications`)
}

async function importFile(file: string, apply: boolean) {
  const rows = JSON.parse(readFileSync(file, 'utf8')) as Row[]
  const tally = { orgs: 0, people: 0, withEmail: 0, guessed: 0, added: 0, matched: 0, review: 0, removed: 0 }
  for (const r of rows) {
    if (!r.hits.length) continue
    const cat = CAT[r.cat]
    const org = apply ? await ensureOrg({ name: r.org, type: cat.orgType as never, website: `https://${r.domain}` }) : { id: '', name: r.org }
    tally.orgs++
    for (const h of r.hits.filter((x) => relevant(x.title, r.cat))) {
      tally.people++
      const valid = h.status === 'valid'
      const guess = !valid && h.confidence >= 85 && h.status !== 'invalid' && h.status !== 'disposable'
      if (valid) tally.withEmail++; else if (guess) tally.guessed++
      if (!apply) { console.log(`would add: ${h.name} | ${h.title} | ${r.org} | ${r.cat} | ${valid ? 'valid' : guess ? 'guess' : 'no email'}`); continue }
      const roles: CrmPersonRole[] = [cat.role]
      const res = await addContactToCrm({
        fullName: h.name, title: h.title, linkedinUrl: h.linkedin, email: valid ? h.email : null,
        guessedEmail: !valid && guess ? h.email : null, guessedEmailBasis: !valid && guess ? `Hunter domain search, status ${h.status ?? 'unknown'}, confidence ${h.confidence}` : null,
        orgId: org.id, orgName: org.name, roles, goals: goalsForRoles(roles), priority: 'P2',
        note: `${h.title} at ${r.org}, a ${cat.label} that buys, funds, refers or advises on help for laid-off professionals. Found by Hunter domain search (${r.domain}), email status ${h.status ?? 'unchecked'}.`,
      })
      if (res.outcome === 'removed') tally.removed++
      else tally[res.outcome]++
    }
  }
  console.log(tally)
}

async function main() {
  const [cmd, a, b] = process.argv.slice(2)
  if (cmd === 'search') await search(a ?? 'buyers-hunter.json')
  else if (cmd === 'import') await importFile(a, b === '--apply')
  else console.log('usage: search <out.json> | import <out.json> [--apply]')
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
