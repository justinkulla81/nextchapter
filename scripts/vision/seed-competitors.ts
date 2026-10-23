/**
 * Fills the Competitors page with everyone we have already discussed, from what is in the repo:
 * docs/WORKFORCE_VENDOR_LANDSCAPE.md, the /vs pages (outplacement), docs/AI_COURSE_SUITE.md, IDEAS.md and the
 * competitor map in docs/funding/company-sweep/competitor_*.csv.
 *
 *   npx tsx --env-file=.env.local scripts/vision/seed-competitors.ts            dry run
 *   npx tsx --env-file=.env.local scripts/vision/seed-competitors.ts --commit
 *
 * Every row is a draft (needsReview) from notes, not from the companies; an existing competitor is only topped up,
 * never overwritten. Numbers appear only where a repo note states them.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { toRows } from '../crm/parse'
import { homepageOf, hostOf, type NamedEntry, type WinEntry } from '../../src/lib/vision/competitor-areas'

const prisma = new PrismaClient()
const COMMIT = process.argv.includes('--commit')

type Seed = {
  name: string; url?: string; segment: string; relationship: 'DIRECT' | 'ADJACENT' | 'PARTNER' | 'SUPPLIER'; areas: string[]; positioning: string
  keyFeatures?: string[]; weWin?: string[]; theyWin?: string[]; weNeed?: string[]
  pricingNote?: string; foundedYear?: number; hq?: string; lastRound?: string; investors?: string; fundingRaisedUsd?: number; headcount?: number
  revenueNote?: string; userCountNote?: string; notes?: string; source: string
}
const L = 'docs/WORKFORCE_VENDOR_LANDSCAPE.md (2026-10-14/15)'
const VS = 'src/lib/marketing/competitor-comparisons.ts and docs/COMPETITIVE_CLAIMS_SUBSTANTIATION.md'
const OUTPLACEMENT_THEY = ['Global footprint across 60+ countries with local labor-law knowledge', 'Large coach bench for a sudden, large reduction', 'Procurement readiness: SOC 2, standard MSAs, long reference list', 'Established brand lowers buyer risk', 'In-person workshops and local offices']
const OUTPLACEMENT_WE = ['Live seat utilization and aggregate outcomes (they commonly report quarterly)', 'Participant keeps the dossier, references and a permanent alumni account after the contract', 'Layoff-specific data: WARN notices, rapid response, per-person outcome reporting', 'Published pricing']

const SEEDS: Seed[] = [
  // Workforce-system vendors
  { name: 'Geographic Solutions', url: 'geographicsolutions.com', segment: 'Workforce-system software for state agencies', relationship: 'ADJACENT', areas: ['workforce_system', 'job_search', 'labor_data', 'resume', 'assessments'],
    positioning: 'One integrated system for state workforce agencies: labor exchange and job bank, case management, labor market information, service tracking, fund management, provider services and federal reporting (VOS Sapphire), with Azure-based AI features.',
    keyFeatures: ['Labor exchange and job bank', 'WIOA case management and federal reporting', 'Labor market information', 'Provider and training-fund management', 'Employer portal'],
    foundedYear: 1992, hq: 'Palm Harbor, FL', headcount: 360, userCountNote: 'Claims 30 to 40+ states and territories',
    weWin: ['Professional and executive layer: coaching, confidential search, outreach tracking, references, recruiter introductions', 'Layoff-specific tools (WARN, rapid response, layoff seats)'],
    theyWin: ['Integrated platform an agency already runs: case management, eligibility, reporting', 'Incumbent in 30 to 40+ states with sole-source renewals'],
    weNeed: ['Source-tagged referrals in and consented outcome counts back (CSV or webhook) so a board can use us beside their system', 'Do not build case management or federal reporting'],
    notes: 'Headcount is the middle of a rough 340 to 375 range from press and profile sites. Not confirmed with the company.', source: L },
  { name: 'CareerTeam / Career Edge', segment: 'Case management and labor exchange for workforce agencies', relationship: 'ADJACENT', areas: ['workforce_system', 'job_search', 'employer_hiring'],
    positioning: 'Case management across WIOA, Wagner-Peyser, TAA, SNAP E&T, RESEA, apprenticeship and youth with embedded federal reporting, an AI labor exchange and an employer ATS. Also delivers services itself.',
    headcount: 377, notes: 'Iron Creek recapitalized it in 2021 to 2022; profiles list about 377 staff. Not confirmed.', source: L },
  { name: 'myOneFlow', segment: 'Low-code WIOA case management', relationship: 'ADJACENT', areas: ['workforce_system', 'resume', 'job_search'],
    positioning: 'Low-code WIOA case management with a client portal, resume builder and AI job recommendations.', pricingNote: 'Listing price from $10,000', source: L },
  { name: 'MonsterWorks (Monster Government Solutions)', url: 'monstergovernmentsolutions.com', segment: 'Case management and job systems for agencies', relationship: 'ADJACENT', areas: ['workforce_system', 'job_search'], positioning: 'Case management for agencies and nonprofits. Not researched in detail.', source: L },
  { name: 'Casebook', segment: 'Case management for agencies and nonprofits', relationship: 'ADJACENT', areas: ['workforce_system'], positioning: 'Case management for agencies and nonprofits. Not researched in detail.', source: L },
  { name: 'FutureFit AI', url: 'futurefit.ai', segment: 'Skills-based career navigation sold to governments', relationship: 'DIRECT', areas: ['career_exploration', 'ai_reskilling', 'job_search', 'learning', 'workforce_system'],
    positioning: 'Skills-based career navigation sold to governments, workforce boards and partners. Closest to a consumer-facing competitor in the workforce space.', lastRound: 'C$5.7M round, 2022',
    notes: 'Revenue and headcount estimates conflict, so none are entered. Company claims many of its customers; only the South Carolina one is verified on a state page.', weWin: ['Professional and executive layer, coaching and layoff-specific tools'], theyWin: ['Already a statewide navigation portal in South Carolina and a claimed state partnership in Connecticut'], source: L },
  { name: 'GoSprout', segment: 'Apprenticeship and work-based-learning management', relationship: 'ADJACENT', areas: ['workforce_system', 'learning'], positioning: 'Apprenticeship and work-based-learning management. Not our user.', fundingRaisedUsd: 1_200_000, lastRound: 'About $1.2M seed', source: L },
  { name: 'Lightcast (Emsi Burning Glass)', url: 'lightcast.io', segment: 'Labor market data and career tools', relationship: 'SUPPLIER', areas: ['labor_data', 'career_exploration', 'higher_ed', 'workforce_system'],
    positioning: 'Labor market data, skills data and Career Coach tools sold to states, workforce boards, community colleges and economic development groups. A data supplier more than a competitor.',
    notes: 'Sells mostly small subscriptions to colleges and boards, and through cooperative contracts (NASPO ValuePoint via Carahsoft). No state-agency contract with amount and end date was found.', source: L },
  { name: 'Burning Glass Institute', url: 'burningglassinstitute.org', segment: 'Nonprofit research on skills and work', relationship: 'PARTNER', areas: ['labor_data', 'career_exploration'],
    positioning: 'Nonprofit research institute on skills and labor markets that wins philanthropic grants as prime. A partner route for us, not a rival.', source: 'docs/funding/company-sweep/competitor_3.csv' },
  { name: 'WIN Learning', url: 'winlearning.com', segment: 'Career-readiness assessments and courseware', relationship: 'ADJACENT', areas: ['assessments', 'learning', 'career_exploration', 'workforce_system'],
    positioning: 'Career-readiness assessments, credentials and courseware, mostly K-12 and workforce programs. Not navigation or labor market data; a weak competitor for our product.', hq: 'Kingston, TN', source: 'docs/funding/company-sweep/competitor_2.csv' },
  { name: 'Eightfold AI', url: 'eightfold.ai', segment: 'Talent intelligence for employers and public sector', relationship: 'ADJACENT', areas: ['employer_hiring', 'career_exploration', 'job_search', 'workforce_system'], positioning: 'Skills-based talent intelligence for employers; also sold to public workforce systems (Florida Commerce and New York State per vendor claims, unverified).', source: 'docs/funding/company-sweep/competitor_4.csv' },
  { name: 'Coursera for Government', url: 'coursera.org', segment: 'Online learning for workforce programs', relationship: 'ADJACENT', areas: ['learning', 'ai_reskilling', 'career_exploration', 'higher_ed'], positioning: 'Online courses and certificates sold to governments, colleges and employers. Missouri DHEWD partnership since July 2020. Also a source we could curate.', source: 'docs/AI_COURSE_SUITE.md and docs/funding/company-sweep/competitor_4.csv' },
  { name: 'Guild', url: 'guild.com', segment: 'Employer education benefits and career coaching', relationship: 'ADJACENT', areas: ['learning', 'benefits', 'coaching', 'higher_ed'], positioning: 'Employer-paid tuition and upskilling benefits with career coaching; the "employer L&D benefit" channel.', source: 'docs/funding/master-list-2026-09-03.csv' },
  { name: 'Jobs for the Future (JFF)', url: 'jff.org', segment: 'Nonprofit workforce and education intermediary', relationship: 'PARTNER', areas: ['career_exploration', 'ai_reskilling', 'workforce_system', 'higher_ed'], positioning: 'Nonprofit that leads workforce grants as prime, including a $2.9M GitLab Foundation grant with the Burning Glass Institute as collaborator. A prime we could sub under.', source: 'docs/funding/company-sweep/competitor_3.csv' },
  // Outplacement
  { name: 'LHH', segment: 'Outplacement and career transition', relationship: 'DIRECT', areas: ['outplacement', 'coaching', 'career_exploration', 'resume', 'recruiters'], positioning: 'Large outplacement provider spanning mid-level to executive programs, part of Adecco Group.',
    pricingNote: 'Roughly $3,500 to $7,000 per person mid-level; $8,000 to $15,000+ executive (our own estimates, not cited)', weWin: OUTPLACEMENT_WE, theyWin: OUTPLACEMENT_THEY, source: VS },
  { name: 'Randstad RiseSmart', segment: 'Outplacement and career transition', relationship: 'DIRECT', areas: ['outplacement', 'coaching', 'resume', 'job_search'], positioning: 'Technology-led outplacement from Randstad.', pricingNote: 'Roughly $3,500 to $7,000 per person (our own estimate, not cited)', weWin: OUTPLACEMENT_WE, theyWin: OUTPLACEMENT_THEY, source: VS },
  { name: 'Careerminds', segment: 'Outplacement and career transition', relationship: 'DIRECT', areas: ['outplacement', 'coaching', 'resume'], positioning: 'Virtual outplacement and career transition services.', pricingNote: 'Roughly $1,000 to $3,000 per person (our own estimate, not cited)', weWin: OUTPLACEMENT_WE, theyWin: OUTPLACEMENT_THEY, source: VS },
  { name: 'INTOO USA (formerly CareerArc outplacement)', segment: 'Outplacement and career transition', relationship: 'DIRECT', areas: ['outplacement', 'coaching', 'job_search', 'assessments', 'resume'],
    positioning: 'On-demand outplacement pairing job matching with coaching, assessments and resume help; executive outplacement is a separate offer. Gi Group bought CareerArc\'s outplacement arm in July 2020.', userCountNote: 'Claims 80,000+ transitions a year and 97% satisfaction (self-reported)',
    pricingNote: 'No published pricing; roughly $1,000 to $3,000 per person in our own estimate', weWin: OUTPLACEMENT_WE, theyWin: OUTPLACEMENT_THEY, weNeed: ['Published outcome numbers to match their volume claims'], notes: 'Called a real fight in docs/WORKFORCE_VENDOR_LANDSCAPE.md.', source: L },
  // AI career tools and resume
  { name: 'Jack & Jill', url: 'jackandjill.ai', segment: 'AI recruiting agents for candidates and employers', relationship: 'DIRECT', areas: ['job_search', 'career_exploration', 'recruiters', 'networking'],
    positioning: 'AI agents for both sides: "Jack" interviews a candidate for about 20 minutes and learns what they want; "Jill" represents employers; matched people are introduced directly to the hiring manager instead of applying. London, expanding to the US.',
    fundingRaisedUsd: 60_000_000, lastRound: '$40M Series A (Air Street, Madrona, Antler); $20M seed Oct 2025 (Creandum)', userCountNote: 'About 350,000 people on its network', notes: 'About $60M in total per press; one headline says $50M. Unknown whether it serves senior professionals as we do.',
    theyWin: ['An interview that builds the profile, then introductions instead of applications'], weNeed: ['Act on what onboarding already collects: introduce people directly instead of only listing jobs'], source: L },
  { name: 'AIApply', url: 'aiapply.co', segment: 'Consumer job-search toolkit', relationship: 'ADJACENT', areas: ['resume', 'job_search', 'interview_prep'],
    positioning: 'Consumer toolkit: Auto-Apply that submits tailored applications, resume builder and ATS scanner, cover letters, interview prep with a live-answer helper. London startup founded 2023.', foundedYear: 2023, hq: 'London', fundingRaisedUsd: 1_000_000, lastRound: '$1.0M seed (Haatch named by CB Insights)',
    pricingNote: 'About $0 to $30 a month; Auto-Apply credits about $39 per 100 (sources disagree)', userCountNote: 'About 4.1/5 on roughly 1,300 Trustpilot reviews, with billing and auto-renewal complaints',
    weWin: ['Coaching, case notes, documents, booking, pivot paths and local pay, none of which it has'], notes: 'Individuals pay it directly; boards and outplacement firms do not. Do not partner (billing complaints).', source: L },
  { name: 'Enhancv', url: 'enhancv.com', segment: 'Resume builder', relationship: 'DIRECT', areas: ['resume', 'interview_prep'], positioning: 'Freemium resume builder: 20+ templates, LinkedIn import, tailoring to a job description, cover letters, AI content, tracks views and downloads. Founded 2014.', foundedYear: 2014, pricingNote: 'About $79.94 per six months; limited free tier',
    theyWin: ['More templates, LinkedIn import and view tracking than Resume Studio'], weNeed: ['Import from a LinkedIn profile or uploaded resume into sections', 'More template choice', 'Per-job tailoring suggestions', 'View and download tracking'], notes: 'Our Resume page currently links candidates to Enhancv for professional help.', source: L },
  { name: 'Humanly', url: 'humanly.io', segment: 'Employer-side conversational AI recruiting', relationship: 'ADJACENT', areas: ['employer_hiring', 'recruiters'], positioning: 'Two-way chat over SMS, email, voice and video for screening, scheduling and reminders, with ATS integrations. Bought Sprockets, Qualifi and HourWork.', lastRound: '$7M round May 2025; one directory lists a $25M Series B April 2026',
    notes: 'Funding figures conflict ($24M total per the company, $49.1M per one directory). Not our user; a possible integration partner.', source: L },
  { name: 'Teal', url: 'tealhq.com', segment: 'Job tracker and resume tools', relationship: 'DIRECT', areas: ['job_search', 'resume', 'networking'], positioning: 'Job application tracker with a one-click save from any site, resume builder and LinkedIn tools.', weNeed: ['One-click "save this job" from any site (browser extension); assessed 2026-10-23 and parked in IDEAS.md'], source: 'IDEAS.md' },
  { name: 'Handshake', url: 'joinhandshake.com', segment: 'Career network for students and graduates', relationship: 'ADJACENT', areas: ['higher_ed', 'job_search', 'networking', 'employer_hiring'], positioning: 'Career network sold to universities, used by students and recent graduates, with employer recruiting. Backlog item: research what it does better and worse.', source: 'Next feature backlog (2026-10)' },
  { name: 'Mercor', url: 'mercor.com', segment: 'AI-vetted expert talent marketplace', relationship: 'ADJACENT', areas: ['recruiters', 'employer_hiring', 'fractional'], positioning: 'AI talent vetting and contract-expert marketplace. Backlog item: how to build our own version of the AI vetting.', source: 'Next feature backlog (2026-10)' },
  // Job boards and professional networks
  { name: 'LinkedIn', url: 'linkedin.com', segment: 'Professional network and job board', relationship: 'DIRECT', areas: ['job_search', 'networking', 'recruiters', 'learning', 'resume'], positioning: 'The default professional network and job board; our Find a job page is held to the bar of LinkedIn, Indeed and Ladders. Also LinkedIn Learning.', source: 'docs/what-you-asked-for.md' },
  { name: 'Indeed', url: 'indeed.com', segment: 'Job board', relationship: 'DIRECT', areas: ['job_search', 'resume', 'employer_hiring'], positioning: 'The largest job board. Blocks automated job-page fetches, so pasted-link flows fall back to pasted text.', source: 'docs/what-you-asked-for.md' },
  { name: 'Ladders', url: 'theladders.com', segment: 'Job board for higher-paid professionals', relationship: 'DIRECT', areas: ['job_search', 'recruiters', 'resume'], positioning: 'Job board and resume services aimed at higher-paid professionals; the other bar named for our job search.', source: 'docs/what-you-asked-for.md' },
  { name: 'Glassdoor', url: 'glassdoor.com', segment: 'Employer reviews and job board', relationship: 'ADJACENT', areas: ['job_search', 'employer_hiring', 'networking'], positioning: 'Company reviews, salaries and jobs.', source: 'repo notes' },
  { name: 'ZipRecruiter', url: 'ziprecruiter.com', segment: 'Job board', relationship: 'ADJACENT', areas: ['job_search', 'employer_hiring'], positioning: 'Job board and employer posting tool.', source: 'repo notes' },
  // Learning
  { name: 'LinkedIn Learning', url: 'learning.linkedin.com', segment: 'Online courses', relationship: 'SUPPLIER', areas: ['learning', 'ai_reskilling'], positioning: 'Course library we could curate in the AI course ladder.', source: 'docs/AI_COURSE_SUITE.md' },
  { name: 'Pluralsight', url: 'pluralsight.com', segment: 'Technology skills courses', relationship: 'SUPPLIER', areas: ['learning', 'ai_reskilling'], positioning: 'Technology courses we could curate.', source: 'docs/AI_COURSE_SUITE.md' },
  { name: 'DataCamp', url: 'datacamp.com', segment: 'Data and AI courses', relationship: 'SUPPLIER', areas: ['learning', 'ai_reskilling'], positioning: 'Data and AI courses we could curate.', source: 'docs/AI_COURSE_SUITE.md' },
  { name: 'edX', url: 'edx.org', segment: 'University online courses', relationship: 'SUPPLIER', areas: ['learning', 'higher_ed'], positioning: 'University-backed online courses.', source: 'docs/AI_COURSE_SUITE.md' },
  { name: 'Google Skills', url: 'skills.google', segment: 'Free courses and certificates', relationship: 'SUPPLIER', areas: ['learning', 'ai_reskilling'], positioning: 'Google courses and credits we could point members to.', source: 'docs/AI_COURSE_SUITE.md' },
  { name: 'Microsoft Learn', url: 'learn.microsoft.com', segment: 'Free courses', relationship: 'SUPPLIER', areas: ['learning', 'ai_reskilling'], positioning: 'Free Microsoft learning paths.', source: 'docs/AI_COURSE_SUITE.md' },
  { name: 'Alison', url: 'alison.com', segment: 'Free online courses', relationship: 'SUPPLIER', areas: ['learning'], positioning: 'Free online courses.', source: 'docs/AI_COURSE_SUITE.md' },
  { name: 'Udemy Business', url: 'udemy.com', segment: 'Employer course library', relationship: 'SUPPLIER', areas: ['learning', 'ai_reskilling'], positioning: 'Employer course library.', source: 'docs/AI_COURSE_SUITE.md' },
  { name: 'Skillsoft', url: 'skillsoft.com', segment: 'Employer and government course library', relationship: 'SUPPLIER', areas: ['learning', 'ai_reskilling'], positioning: 'Employer course library, also sold to governments.', source: 'docs/AI_COURSE_SUITE.md' },
  // Fractional and gig
  { name: 'Upwork', url: 'upwork.com', segment: 'Freelance marketplace', relationship: 'ADJACENT', areas: ['fractional'], positioning: 'Freelance marketplace; part of the gig directory ground.', source: 'repo notes' },
  { name: 'Toptal', url: 'toptal.com', segment: 'Vetted freelance talent', relationship: 'ADJACENT', areas: ['fractional', 'recruiters'], positioning: 'Vetted freelance talent network.', source: 'repo notes' },
]

function csvRows(file: string) { return toRows(readFileSync(join(process.cwd(), 'docs/funding/company-sweep', file), 'utf8')) }
const buyer = (r: ReturnType<typeof csvRows>[number]): NamedEntry => ({
  name: r.get('Organization') ?? 'Unknown buyer',
  note: [r.get('Geography'), (r.get('Award Amount') ?? '').slice(0, 70), (r.get('Verification') ?? '').startsWith('Verified') ? 'verified' : 'unverified'].filter(Boolean).join(', '),
  url: /^https?:/.test(r.get('Link') ?? '') ? r.get('Link')! : undefined,
})
function fromMap(): Record<string, { customers: NamedEntry[]; wins: WinEntry[] }> {
  const out: Record<string, { customers: NamedEntry[]; wins: WinEntry[] }> = {}
  const add = (name: string, rows: ReturnType<typeof csvRows>) => { out[name] ??= { customers: [], wins: [] }; out[name].customers.push(...rows.map(buyer)) }
  add('Geographic Solutions', csvRows('competitor_1.csv'))
  const c2 = csvRows('competitor_2.csv')
  add('FutureFit AI', c2.filter((r) => /FutureFit/i.test(r.get('Opportunity') ?? '')))
  add('WIN Learning', c2.filter((r) => /WIN Learning/i.test(r.get('Opportunity') ?? '') || /Department/.test(r.get('Organization') ?? '') && !/FutureFit/i.test(r.get('Opportunity') ?? '')))
  const c3 = csvRows('competitor_3.csv')
  add('Lightcast (Emsi Burning Glass)', c3.filter((r) => /Lightcast/i.test(r.get('Opportunity') ?? '')))
  out['Burning Glass Institute'] = { customers: [], wins: c3.filter((r) => /Burning Glass|Carnegie|Skills First/i.test(r.get('Opportunity') ?? '')).map((r) => ({ what: (r.get('Opportunity') ?? '').slice(0, 140), buyer: r.get('Organization') ?? undefined, amount: (r.get('Award Amount') ?? '').slice(0, 60) || undefined, url: /^https?:/.test(r.get('Link') ?? '') ? r.get('Link')! : undefined })) }
  const c4 = csvRows('competitor_4.csv')
  add('Eightfold AI', c4.filter((r) => /Eightfold/i.test(r.get('Opportunity') ?? '')))
  add('Coursera for Government', c4.filter((r) => /Coursera/i.test(r.get('Opportunity') ?? '')))
  return out
}

async function main() {
  console.log(`COMPETITOR SEED — ${COMMIT ? 'COMMIT' : 'DRY RUN'}`)
  const map = fromMap()
  const existing = await prisma.productCompetitor.findMany({ select: { id: true, name: true, url: true } })
  let created = 0, skipped = 0
  for (const s of SEEDS) {
    const url = s.url ? homepageOf(s.url) : null
    const dup = existing.find((e) => e.name.toLowerCase() === s.name.toLowerCase() || (url && e.url && hostOf(e.url) === hostOf(url)))
    if (dup) { skipped++; console.log(`  keep   ${s.name} (already tracked)`); continue }
    const m = map[s.name]
    console.log(`  add    ${s.name}${m ? `  [${m.customers.length} customers, ${m.wins.length} wins]` : ''}`)
    created++
    if (!COMMIT) continue
    await prisma.productCompetitor.create({
      data: {
        name: s.name, url, segment: s.segment, relationship: s.relationship, areas: s.areas, positioning: s.positioning,
        keyFeatures: s.keyFeatures ?? [], weWin: s.weWin ?? [], theyWin: s.theyWin ?? [], weNeed: s.weNeed ?? [],
        customers: (m?.customers ?? []) as unknown as object, wins: (m?.wins ?? []) as unknown as object,
        pricingNote: s.pricingNote ?? null, foundedYear: s.foundedYear ?? null, hq: s.hq ?? null, lastRound: s.lastRound ?? null,
        investors: s.investors ?? null, fundingRaisedUsd: s.fundingRaisedUsd ?? null, headcount: s.headcount ?? null,
        revenueNote: s.revenueNote ?? null, userCountNote: s.userCountNote ?? null,
        notes: [s.notes, `Seeded 2026-10-23 from ${s.source}. A draft from our notes, not confirmed with the company.`].filter(Boolean).join(' '),
        filledBy: 'seed', needsReview: true, lastReviewedAt: new Date(),
      },
    })
  }
  console.log(`\n${created} to add, ${skipped} already there.`)
  if (!COMMIT) console.log('Dry run only. Re-run with --commit to write.')
}
main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
