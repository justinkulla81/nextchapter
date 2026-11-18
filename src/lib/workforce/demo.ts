// A workforce demo, generated for any region: a workforce board, economic
// development org, chamber or community org types its name and main city
// and gets a working Program workspace in a minute.
//
// Real and public: the region (Census places within the radius), its
// workforce board and county unemployment (BLS), WARN notices, and real job
// postings near it. Fictional, every row isSampleData: the member
// companies, participants, their searches and hires. Demo orgs never email
// anyone (sendCampaign skips isDemo), and public demos expire after 30 days.

import { seedHubSamples } from '@/lib/workforce/demo-hubs'
import { demoTrainingOfferings } from './demo-training'
import 'server-only'
import { createHash, randomBytes } from 'crypto'
import type { CurrentJobStatus, InstitutionOrgType, JourneyStage, JourneyType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { dossierLineFor } from './demo-dossier-lines'
import { findCityHero } from './city-hero'
import { localArea, placeAt, type LocalSettings } from './local'
import { countyKey, STATE_NAMES } from './places'
import { skillsForTitle } from '@/lib/learning/plan'

const DAY = 86_400_000
export const PUBLIC_DEMO_DAYS = 30

const FIRST = ['Avery', 'Jordan', 'Morgan', 'Riley', 'Casey', 'Quinn', 'Rowan', 'Harper', 'Emerson', 'Finley', 'Sawyer', 'Reese', 'Dakota', 'Hayden', 'Parker', 'Logan', 'Elliot', 'Blair', 'Cameron', 'Drew', 'Taylor', 'Jamie', 'Alex', 'Kendall']
const LAST = ['Abernathy', 'Bellweather', 'Castellano', 'Drummond', 'Ellsworth', 'Fairbanks', 'Galloway', 'Hollister', 'Iverson', 'Kincaid', 'Lockhart', 'Merriweather', 'Northcott', 'Oakridge', 'Pemberton', 'Quillfeather', 'Ravensworth', 'Sterling', 'Thistlewood', 'Underhill', 'Vantreese', 'Whitcombe']
const TITLES = ['Operations Manager', 'Senior Financial Analyst', 'Customer Experience Director', 'Logistics Supervisor', 'HR Business Partner', 'Marketing Manager', 'Software Engineer', 'Claims Manager', 'Project Manager', 'Account Executive', 'Data Analyst', 'Plant Controller']
// Invented names: nothing that could be read as a real local employer.
const COMPANIES: { name: string; industry: string }[] = [
  { name: 'Riverbend Logistics Co.', industry: 'Logistics' },
  { name: 'Summit Ridge Health Partners', industry: 'Healthcare' },
  { name: 'Ironvale Manufacturing', industry: 'Manufacturing' },
  { name: 'Keystone Mutual Insurance', industry: 'Insurance' },
  { name: 'Brightline Customer Solutions', industry: 'Customer experience' },
  { name: 'Northfork Distilling Co.', industry: 'Food and beverage' },
  { name: 'Lanterra Software', industry: 'Technology' },
  { name: 'Copperleaf Financial', industry: 'Financial services' },
]
const JOURNEYS: JourneyType[] = ['LAID_OFF', 'LAID_OFF', 'LAID_OFF', 'LAID_OFF', 'CAREER_CHANGE', 'LAID_OFF']
// Beyond the layoffs: people the program helps for other reasons (Program › People tracks, src/lib/workforce/people-crm.ts).
type ExtraKind = 'moving' | 'grad' | 'growing' | 'pivot'
const EXTRAS: { kind: ExtraKind; n: number; journey: JourneyType; status: CurrentJobStatus }[] = [
  { kind: 'moving', n: 18, journey: 'EXPLORING_MOVE', status: 'EMPLOYED_CONSIDERING_MOVE' },
  { kind: 'grad', n: 16, journey: 'STUDENT_NEW_GRAD', status: 'NEW_GRADUATE_FIRST_JOB' },
  { kind: 'growing', n: 14, journey: 'GROWING', status: 'EMPLOYED_CONSIDERING_MOVE' },
  { kind: 'pivot', n: 12, journey: 'CAREER_CHANGE', status: 'CAREER_PIVOT' },
]
// The program's own coaches (Talent Hub › participant view › Coaching). Fictional, isSampleData: coach matching and the
// coach digest skip sample coaches, so they never reach a real member.
const DEMO_COACHES = [
  { fullName: 'Monica Halverson', industries: ['Healthcare', 'Insurance'], seniorityFit: ['Manager', 'Director'] },
  { fullName: 'Terrence Oyelaran', industries: ['Logistics', 'Manufacturing'], seniorityFit: ['Supervisor', 'Manager'] },
  { fullName: 'Grace Lindqvist', industries: ['Financial services', 'Technology'], seniorityFit: ['Individual contributor', 'Manager'] },
]
const demoCoachEmail = (slug: string, k: number) => `coach${k + 1}@${slug}.example.com`

// What people told NextChapter they need (CandidateProfile.benefitsPressures and biggestBarriers), for benefit matching.
const PRESSURES = ['RENT_MORTGAGE', 'HEALTH_INSURANCE', 'DEPENDENTS_CHILDCARE', 'DEBT_PAYMENTS', 'NO_EMERGENCY_SAVINGS', 'SUPPORTING_FAMILY']
const BARRIERS = ['life_logistics', 'skills_gap', 'local_job_market', 'interview_nerves', 'ats_blackhole']
const STAGES: JourneyStage[] = ['EXPLORING', 'PREPARING', 'APPLYING', 'APPLYING', 'INTERVIEWING', 'INTERVIEWING', 'OFFER']
// Coarse résumé fields for the sample candidates, by title (function, level, industry bucket, years, keywords).
const PROFILES: Record<string, { fn: string; level: string; industry: string; years: number; kw: string[] }> = {
  'Operations Manager': { fn: 'Operations', level: 'Manager', industry: 'Transportation & Logistics', years: 14, kw: ['Process improvement', 'Lean six sigma', 'Supply chain', 'Project management', 'Excel', 'Budgeting', 'SAP'] },
  'Senior Financial Analyst': { fn: 'Finance', level: 'IC', industry: 'Financial Services & Banking', years: 9, kw: ['Financial modeling', 'Forecasting', 'SQL', 'Excel', 'Tableau', 'GAAP', 'Power BI'] },
  'Customer Experience Director': { fn: 'Customer success', level: 'Director', industry: 'Retail & E-commerce', years: 15, kw: ['Customer experience', 'Salesforce', 'Data analysis', 'Change management', 'People management'] },
  'Logistics Supervisor': { fn: 'Operations', level: 'Manager', industry: 'Transportation & Logistics', years: 8, kw: ['Supply chain', 'Logistics', 'Excel', 'SAP', 'Lean'] },
  'HR Business Partner': { fn: 'People and HR', level: 'Manager', industry: 'Healthcare & Hospital Systems', years: 11, kw: ['Workday', 'Recruiting', 'Employee relations', 'Change management', 'Compliance'] },
  'Marketing Manager': { fn: 'Marketing', level: 'Manager', industry: 'Consumer Packaged Goods', years: 10, kw: ['SEO', 'Content strategy', 'Salesforce', 'Data analysis', 'Generative AI'] },
  'Software Engineer': { fn: 'Engineering', level: 'IC', industry: 'Technology & Software', years: 8, kw: ['Python', 'SQL', 'AWS', 'Agile', 'Generative AI'] },
  'Claims Manager': { fn: 'Operations', level: 'Manager', industry: 'Insurance', years: 13, kw: ['Claims', 'Compliance', 'Excel', 'Data analysis', 'People management'] },
  'Project Manager': { fn: 'Project management', level: 'Manager', industry: 'Professional Services & Consulting', years: 9, kw: ['Project management', 'Agile', 'Scrum', 'Change management'] },
  'Account Executive': { fn: 'Sales', level: 'IC', industry: 'Technology & Software', years: 7, kw: ['Salesforce', 'Sales', 'Negotiation', 'Business development'] },
  'Data Analyst': { fn: 'Data', level: 'IC', industry: 'Financial Services & Banking', years: 5, kw: ['SQL', 'Python', 'Tableau', 'Power BI', 'Excel'] },
  'Plant Controller': { fn: 'Finance', level: 'Director', industry: 'Manufacturing & Industrial', years: 18, kw: ['GAAP', 'CPA', 'SAP', 'Budgeting', 'Forecasting'] },
}
const ELSEWHERE = [
  ['Nashville', 'TN'],
  ['Chicago', 'IL'],
  ['Atlanta', 'GA'],
  ['Charlotte', 'NC'],
  ['Dallas', 'TX'],
] as const

// Deterministic 0..1 per (seed, i, salt).
const rand = (seed: string, i: number, salt: number) => createHash('sha256').update(`${seed}:${i}:${salt}`).digest().readUInt32BE(0) / 0xffffffff
const pick = <T,>(list: readonly T[], seed: string, i: number, salt: number) => list[Math.floor(rand(seed, i, salt) * list.length) % list.length]

export const demoUserPrefix = (slug: string) => `demo-${slug}-`

export function slugFor(name: string, salt: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32)
  return `demo-${base || 'region'}-${salt}`
}

export type WorkforceDemoInput = {
  name: string
  orgType: Exclude<InstitutionOrgType, 'COLLEGE'>
  anchorCity: string
  anchorState: string
  radiusMiles?: number
  // Brand colour (#RRGGBB) and the person the demo is prepared for.
  accentColor?: string
  preparedFor?: string
  // 'public' demos expire; 'admin' ones stay until deleted.
  source: 'public' | 'admin'
  requestedBy: string | null
  // The directory record the demo was built from ("WORKFORCE_BOARD:KY-247"), so the demo page finds it again
  // instead of building another (src/lib/workforce/demo-orgs.ts). Null when the organization was typed in.
  sourceOrg?: string | null
}

export type WorkforceDemoResult = { slug: string; institutionId: string } | { error: string }

export async function generateWorkforceDemo(input: WorkforceDemoInput, now = new Date()): Promise<WorkforceDemoResult> {
  const name = input.name.trim().slice(0, 80)
  const anchorState = input.anchorState.trim().toUpperCase()
  const anchorCity = input.anchorCity.trim().slice(0, 60)
  if (!name) return { error: 'Add your organization’s name.' }
  if (!STATE_NAMES[anchorState]) return { error: 'Use the two-letter state, like KY.' }
  const anchor = await placeAt(anchorCity, anchorState)
  if (!anchor) return { error: `We can’t find ${anchorCity}, ${anchorState} in the Census place list. Check the spelling, or use the nearest larger city.` }
  // The splash picture: an iconic view of the city, looked up while the rest of the region loads (src/lib/workforce/city-hero.ts).
  const heroLookup = findCityHero(anchorCity, STATE_NAMES[anchorState])
  const radiusMiles = Math.min(Math.max(Math.round(input.radiusMiles ?? 40), 10), 100)
  const local: LocalSettings = { anchorCity, anchorState, radiusMiles, label: `the ${anchorCity} region` }
  const area = await localArea(local)

  // The region: the anchor's county (Census) and the workforce board that serves it.
  const { nearby, localTowns } = await townsNear(anchor, area, anchorCity, anchorState, radiusMiles)
  const anchorCounty = nearby.find((p) => p.state === anchorState && p.nameKey === anchorCity.toLowerCase())?.county ?? null
  const boards = await prisma.workforceBoard.findMany({ where: { state: anchorState }, select: { name: true, website: true, counties: true, placeCounties: true } })
  const board = anchorCounty ? boards.find((b) => [...b.counties, ...b.placeCounties].includes(countyKey(anchorCounty))) : null
  const counties = board ? [...new Set([...board.counties, ...board.placeCounties])].slice(0, 12) : anchorCounty ? [countyKey(anchorCounty)] : []
  // Stored nameKeys keep the space ("los angeles"), board counties do not: join on the key of the name.
  const wanted = new Set(counties.map((k) => k.replace(/\s+/g, '')))
  const labor = counties.length
    ? (await prisma.countyLabor.findMany({ where: { state: anchorState }, orderBy: { laborForce: 'desc' }, select: { name: true, rate: true, period: true, laborForce: true } }))
        .filter((r) => wanted.has(countyKey(r.name)))
        .slice(0, 4)
    : []

  const salt = createHash('sha256').update(`${name}|${now.toISOString()}|${Math.random()}`).digest('hex').slice(0, 5)
  const slug = slugFor(name, salt)
  const seed = slug
  const expiresAt = input.source === 'public' ? new Date(now.getTime() + PUBLIC_DEMO_DAYS * DAY) : null

  const hero = await heroLookup
  const profile = {
    tagline: `Keeping ${anchorCity}'s talent working in ${anchorCity}.`,
    ...(hero ? { heroImageUrl: hero.url, heroCredit: hero.credit, heroSourceUrl: hero.sourceUrl } : {}),
    region: {
      name: `${anchorCity} region`,
      state: anchorState,
      counties,
      areas: [{ state: anchorState, counties }],
      ...(labor.length
        ? {
            unemployment: labor
              .filter((l) => l.rate !== null)
              .map((l) => ({ area: l.name, rate: l.rate!, period: l.period ?? '', laborForce: l.laborForce, source: 'U.S. Bureau of Labor Statistics, Local Area Unemployment Statistics', sourceUrl: 'https://www.bls.gov/lau/' })),
          }
        : {}),
    },
    ...(board ? { workforce: { board: { name: board.name, website: board.website, counties: board.counties, source: 'CareerOneStop', sourceUrl: 'https://www.careeronestop.org/' } } } : {}),
  }

  const institution = await prisma.institution.create({
    data: {
      slug,
      name,
      programBrandName: `${name} Talent Hub`,
      accentColor: /^#[0-9a-fA-F]{6}$/.test(input.accentColor ?? '') ? input.accentColor! : '#1f5f8b',
      orgType: input.orgType,
      tier: 'INSTITUTION',
      includedSeats: 500,
      isDemo: true,
      isSampleData: true,
      profile: profile as Prisma.InputJsonValue,
      enabledFeatures: {
        graceDays: 60,
        fiscalYearStartMonth: 7,
        engagementWeights: {},
        wioa: input.orgType === 'WORKFORCE_BOARD',
        local,
        // The real workforce board's site behind "Your local career center".
        ...(board?.website ? { services: { career_center: { on: true, provider: 'college', linkUrl: board.website } } } : {}),
        demo: { source: input.source, requestedBy: input.requestedBy, preparedFor: input.preparedFor?.trim().slice(0, 80) || null, createdAt: now.toISOString(), expiresAt: expiresAt?.toISOString() ?? null, sourceOrg: input.sourceOrg ?? null },
      },
    },
    select: { id: true },
  })
  const institutionId = institution.id

  try {
    await seedWorkforceDemo({ institutionId, slug, seed, now, localTowns, name })
  } catch (e) {
    await deleteWorkforceDemo(slug)
    throw e
  }
  return { slug, institutionId }
}

async function seedWorkforceDemo(args: { institutionId: string; slug: string; seed: string; now: Date; localTowns: { city: string; state: string }[]; name: string }) {
  const { institutionId, slug, seed, now, localTowns } = args
  // Half the picks are the main city; the rest spread over nearby towns.
  const town = (i: number, salt: number) => (rand(seed, i, salt + 100) < 0.5 ? localTowns[0] : pick(localTowns, seed, i, salt))

  // Member companies: eight, three hiring.
  const companies = await Promise.all(
    COMPANIES.map((c, i) => {
      const t = town(i, 1)
      return prisma.memberCompany.create({
        data: { institutionId, name: c.name, industry: c.industry, city: t.city, state: t.state, contactName: 'HR team', hiring: i % 3 === 1, isSampleData: true, createdAt: new Date(now.getTime() - (120 - i * 9) * DAY) },
        select: { id: true, name: true },
      })
    }),
  )

  // Four companies have connected logins (sample employer accounts): the
  // three hiring ones, and one that isn't hiring but just asked for seats.
  const employerEps: { id: string; name: string }[] = []
  for (const [k, c] of companies.entries()) {
    if (k % 3 !== 1 && k !== 5) continue
    const ep = await prisma.employerProfile.create({ data: { userId: `${demoUserPrefix(slug)}employer-${k}`, companyName: c.name, companyIndustry: COMPANIES[k].industry, contactName: 'Talent team', isSampleData: true }, select: { id: true } })
    await prisma.institutionEmployer.create({ data: { institutionId, employerProfileId: ep.id, status: 'APPROVED', approvedBy: 'member-invite', approvedAt: now, isSampleData: true } })
    employerEps.push({ id: ep.id, name: c.name })
    await prisma.memberCompany.update({ where: { id: c.id }, data: { employerProfileId: ep.id, connectedAt: now, invitedEmail: `talent@${c.name.toLowerCase().replace(/[^a-z]+/g, '')}.example.com` } })
  }

  // Jobs the connected employers posted: three waiting for the organization, one declined with a reason, one with NextChapter.
  const employerJobs = [
    { k: 0, title: 'Patient Access Supervisor', status: 'org_pending', ago: 1, reason: null },
    { k: 1, title: 'Operations Analyst', status: 'org_pending', ago: 2, reason: null },
    { k: 2, title: 'Quality Assurance Coordinator', status: 'org_pending', ago: 4, reason: null },
    { k: 3, title: 'Branch Operations Manager', status: 'rejected', ago: 9, reason: 'The link goes to a general careers page. Link to the specific posting and post it again.' },
    { k: 0, title: 'Clinical Scheduler', status: 'pending', ago: 6, reason: null },
  ].filter((j) => employerEps[j.k])
  if (employerEps.length) {
    await prisma.exclusiveJobPosting.createMany({
      data: employerJobs.map((j, i) => ({
        title: j.title,
        companyName: employerEps[j.k].name,
        location: localTowns[0] ? `${localTowns[0].city}, ${localTowns[0].state}` : null,
        url: `https://example.com/careers/${slug}/${i + 1}`,
        postingType: 'direct',
        salaryCurrency: 'USD',
        audienceTier: 'ALL_CANDIDATES',
        distribution: 'OPEN',
        disclosure: 'OPEN',
        status: j.status,
        rejectionReason: j.reason,
        source: 'institution_employer',
        addedBy: `employer:${employerEps[j.k].id}`,
        institutionScopeId: institutionId,
        createdAt: new Date(now.getTime() - j.ago * DAY),
        expiresAt: new Date(now.getTime() + 60 * DAY),
      })),
      skipDuplicates: true,
    })
  }

  // A seat request waiting for the org's answer.
  await prisma.rapidResponse.create({
    data: {
      institutionId,
      memberCompanyId: companies[5].id,
      seats: 35,
      employerName: companies[5].name,
      title: `Free career support for ${companies[5].name} employees`,
      message: '',
      programIds: [],
      isActive: false,
      requestStatus: 'REQUESTED',
      requestNote: 'Closing the bottling line in six weeks; mostly supervisors and maintenance leads.',
      requestedAt: new Date(now.getTime() - 2 * DAY),
      createdBy: 'demo',
      isSampleData: true,
    },
  })

  // Three layoffs with seats; the newest still open.
  const layoffSpecs = [
    { company: 0, seats: 80, daysAgo: 70, open: false },
    { company: 4, seats: 60, daysAgo: 38, open: true },
    { company: 2, seats: 40, daysAgo: 12, open: true },
  ]
  const layoffs = await Promise.all(
    layoffSpecs.map((l) =>
      prisma.rapidResponse.create({
        data: {
          institutionId,
          memberCompanyId: companies[l.company].id,
          seats: l.seats,
          employerName: companies[l.company].name,
          title: `Free career support for ${companies[l.company].name} employees`,
          message: `${args.name} is giving people affected by the ${companies[l.company].name} layoff free access to NextChapter. Sign up to claim your seat.`,
          programIds: [],
          isActive: l.open,
          createdBy: 'demo',
          isSampleData: true,
          createdAt: new Date(now.getTime() - l.daysAgo * DAY),
        },
        select: { id: true },
      }),
    ),
  )

  // Funding being pursued, and how far each layoff response has got, so the Funding and Reports areas have something to read.
  const ky = localTowns[0]?.state === 'KY'
  const apps = await Promise.all(
    [
      { name: ky ? 'Governor’s Reserve Fund' : 'State workforce innovation grant', funder: ky ? 'Kentucky Education and Labor Cabinet' : 'State workforce agency', status: 'DRAFTING', due: 10, req: 250000, aw: null, mreq: 50000, mcom: 30000, partners: ['Workforce board', 'Partner college', ...employerEps.map((e) => e.name)] },
      { name: ky ? 'Talent Recruitment Grant' : 'Talent attraction grant', funder: ky ? 'Kentucky Cabinet for Economic Development' : 'State economic development agency', status: 'CONSIDERING', due: null, req: 500000, aw: null, mreq: 125000, mcom: 0, partners: ['Neighboring counties'] },
      { name: 'National Dislocated Worker Grant', funder: 'U.S. Department of Labor, through the state', status: 'SUBMITTED', due: null, req: 800000, aw: null, mreq: null, mcom: null, partners: ['State workforce agency'] },
    ].map((a) =>
      prisma.fundingApplication.create({
        data: { institutionId, name: a.name, funder: a.funder, status: a.status, amountRequested: a.req, amountAwarded: a.aw, matchRequired: a.mreq, matchCommitted: a.mcom, dueDate: a.due ? new Date(now.getTime() + a.due * DAY) : null, partners: a.partners, createdBy: 'demo', isSampleData: true },
        select: { id: true },
      }),
    ),
  )
  await prisma.rapidResponse.update({ where: { id: layoffs[0].id }, data: { fundingApplicationId: apps[0].id } })

  // What a connected member company asked for: training (its L&D contact) and support for the first application (its grants
  // contact), from the company a demo preview acts as (the first connected one by name), so Training and Grants have rows.
  const firstConnected = [...employerEps].sort((a, b) => a.name.localeCompare(b.name))[0]
  const firstCompany = firstConnected ? companies.find((c) => c.name === firstConnected.name) : undefined
  if (firstCompany) {
    await prisma.memberCompanyRequest.createMany({
      data: [
        { institutionId, memberCompanyId: firstCompany.id, kind: 'TRAINING', topic: 'Project management', people: 18, note: 'Team leads first; evenings or online.', status: 'ACCEPTED', answerNote: 'A partner college has a cohort starting next month. We will send the details.', answeredBy: 'demo', answeredAt: new Date(now.getTime() - 3 * DAY), requestedBy: 'demo', isSampleData: true, createdAt: new Date(now.getTime() - 9 * DAY) },
        { institutionId, memberCompanyId: firstCompany.id, kind: 'TRAINING', topic: 'AI tools for analysts', people: 12, note: null, status: 'REQUESTED', requestedBy: 'demo', isSampleData: true, createdAt: new Date(now.getTime() - 2 * DAY) },
        { institutionId, memberCompanyId: firstCompany.id, kind: 'GRANT_PARTNER', topic: apps.length ? (ky ? 'Governor’s Reserve Fund' : 'State workforce innovation grant') : 'A state training grant', offers: ['LETTER', 'MATCH'], matchAmount: 15000, fundingApplicationId: apps[0]?.id ?? null, note: 'In-kind: trainer time and a classroom.', status: 'REQUESTED', requestedBy: 'demo', isSampleData: true, createdAt: new Date(now.getTime() - 1 * DAY) },
        { institutionId, memberCompanyId: firstCompany.id, kind: 'WORKFORCE_COLLAB', topic: 'Customer service and scheduling', offers: ['OJT', 'HIRING_EVENT'], people: 6, note: 'Spring start; day shifts.', status: 'ACCEPTED', answerNote: 'The job center will set up the on-the-job training contract and a hiring event in March.', answeredBy: 'demo', answeredAt: new Date(now.getTime() - 4 * DAY), requestedBy: 'demo', isSampleData: true, createdAt: new Date(now.getTime() - 11 * DAY) },
        { institutionId, memberCompanyId: firstCompany.id, kind: 'COLLEGE_COLLAB', topic: 'Any college near us', offers: ['INTERNSHIPS', 'ADVISORY'], people: 4, note: 'Paid summer internships in operations.', status: 'REQUESTED', requestedBy: 'demo', isSampleData: true, createdAt: new Date(now.getTime() - 1 * DAY) },
      ],
    })
  }
  const stepKeys = ['notice', 'employer', 'session', 'seats', 'hiring', 'training']
  await prisma.rapidResponseStep.createMany({
    data: [6, 4, 2].flatMap((n, i) => stepKeys.slice(0, n).map((key) => ({ rapidResponseId: layoffs[i].id, key, doneBy: 'demo', isSampleData: true, doneAt: new Date(now.getTime() - (layoffSpecs[i].daysAgo - stepKeys.indexOf(key)) * DAY) }))),
  })

  // A sample partner view, so the Partners area and the public view page have something to open.
  await prisma.partnerView.create({
    data: { institutionId, token: randomBytes(24).toString('base64url'), partnerName: ky ? 'Jefferson Community and Technical College' : 'A partner college', partnerKind: 'COLLEGE', scopes: ['SKILLS', 'TALENT', 'JOBS', 'PROGRAMS'], note: 'What employers here ask for, and where our people have the skills: a starting point for program planning.', expiresAt: new Date(now.getTime() + 90 * DAY), createdBy: 'demo', isSampleData: true },
  })

  // A sample ecosystem: member companies at different stages, and two partner colleges.
  await prisma.ecosystemPartner.createMany({
    data: [
      ...companies.slice(0, 5).map((c, i) => ({ institutionId, name: c.name, kind: 'EMPLOYER', source: 'MEMBER_COMPANY', refId: c.id, status: i === 0 ? 'CONFIRMED' : i === 1 ? 'INVITED' : 'UNINVITED', inviteToken: i <= 1 ? randomBytes(24).toString('base64url') : null, invitedAt: i <= 1 ? new Date(now.getTime() - 12 * DAY) : null, commitments: i === 0 ? ['HIRING', 'OPENINGS', 'MENTORS'] : [], claimedAt: i === 0 ? new Date(now.getTime() - 6 * DAY) : null, claimName: i === 0 ? 'HR team' : null, claimEmail: i === 0 ? 'talent@example.com' : null, createdBy: 'demo', isSampleData: true })),
      { institutionId, name: 'A partner college', kind: 'COLLEGE', source: 'MANUAL', refId: null, status: 'CLAIMED', inviteToken: randomBytes(24).toString('base64url'), invitedAt: new Date(now.getTime() - 9 * DAY), claimName: 'Dana Whitfield', claimTitle: 'Director of Workforce Partnerships', claimEmail: 'dwhitfield@example.edu', claimNote: 'We can open cohort seats each term.', commitments: ['SEATS', 'SPACE'], claimedAt: new Date(now.getTime() - 3 * DAY), createdBy: 'demo', isSampleData: true },
      { institutionId, name: 'A second college', kind: 'COLLEGE', source: 'MANUAL', refId: null, status: 'UNINVITED', createdBy: 'demo', isSampleData: true },
    ],
  })

  // The Education Hub catalog and the Workforce Hub's partners and match, so each hub has something to read.
  await seedHubSamples(institutionId, apps.map((a) => a.id)).catch((e) => console.error('demo hub samples failed', e))

  // A view shared with the confirmed partner, so the partner preview (Shared with you) has something to open.
  const confirmedPartner = await prisma.ecosystemPartner.findFirst({ where: { institutionId, status: 'CONFIRMED' }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true } })
  if (confirmedPartner) {
    await prisma.partnerView.create({
      data: { institutionId, token: randomBytes(24).toString('base64url'), partnerName: confirmedPartner.name, partnerKind: 'EMPLOYER', scopes: ['SKILLS', 'JOBS'], note: 'What employers ask for across the region, and the open jobs near you.', expiresAt: new Date(now.getTime() + 90 * DAY), createdBy: 'demo', isSampleData: true, ecosystemPartnerId: confirmedPartner.id },
    })
  }

  // Three open jobs near the anchor city, featured, so the Jobs area and the member's list show what featuring does.
  const openJobs = !localTowns[0] ? [] : await prisma.exclusiveJobPosting
    .findMany({
      where: { status: 'approved', archivedAt: null, institutionScopeId: null, locationState: localTowns[0]?.state, location: { contains: localTowns[0]?.city ?? '', mode: 'insensitive' }, salaryMin: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: { id: true },
    })
    .catch(() => [])
  const why = ['Hires from our layoff response', 'Pay stated up front', 'Entry point for career changers']
  if (openJobs.length) await prisma.featuredJob.createMany({ data: openJobs.map((j, i) => ({ institutionId, postingId: j.id, note: why[i], createdBy: 'demo' })), skipDuplicates: true })

  // Two real Louisville employers' public job boards, connected, so the Jobs area shows what a connection brings in. A failed read
  // (board down, no network) just leaves the connection without jobs; the demo still builds.
  if (localTowns[0]?.city.toLowerCase() === 'louisville') {
    const { syncFeed } = await import('@/lib/workforce/job-feeds-sync')
    for (const b of [
      { provider: 'LEVER', token: 'germanamerican', companyName: 'German American Bank' },
      { provider: 'GREENHOUSE', token: 'ecoatmgazelle', companyName: 'ecoATM | Gazelle' },
    ]) {
      const feed = await prisma.groupJobFeed.create({ data: { institutionId, ...b, locationFilter: localTowns[0].city, includeRemote: false, createdBy: 'demo', isSampleData: true }, select: { id: true } }).catch(() => null)
      if (feed) await syncFeed(feed.id).catch(() => null)
    }
  }

  // Participants: 150 from the layoffs or signed up directly, then 60 more on other tracks (moving here, new graduates,
  // employed and growing, career pivot).
  const N = 150
  const extraKind = (i: number): (typeof EXTRAS)[number] | null => {
    let k = i - N
    for (const e of EXTRAS) {
      if (k < e.n) return k >= 0 ? e : null
      k -= e.n
    }
    return null
  }
  const TOTAL = N + EXTRAS.reduce((a, e) => a + e.n, 0)
  const featured = 3
  const memberId = (i: number) => (i === featured ? `${slug}_member_featured` : `${slug}_m_${String(i).padStart(3, '0')}`)
  const candId = (i: number) => `${slug}_cand_${String(i).padStart(3, '0')}`
  const people = Array.from({ length: TOTAL }, (_, i) => {
    const extra = extraKind(i)
    const l = extra ? -1 : i < 70 ? 0 : i < 115 ? 1 : i < 140 ? 2 : -1
    const spec = l >= 0 ? layoffSpecs[l] : null
    const joinedAt = spec ? new Date(now.getTime() - (spec.daysAgo - 2 - Math.floor(rand(seed, i, 2) * Math.min(spec.daysAgo - 3, 20))) * DAY) : new Date(now.getTime() - Math.floor(rand(seed, i, 2) * 90) * DAY)
    const joined = i === featured || !!extra || rand(seed, i, 3) < 0.72
    const title = extra?.kind === 'grad' ? 'Recent graduate' : pick(TITLES, seed, i, 6)
    return { i, l, extra, joined, joinedAt, first: pick(FIRST, seed, i, 4), last: pick(LAST, seed, i, 5), title }
  })
  // Joined: a sample candidate each, at a stage of their search; the oldest
  // layoff has the most people landed.
  const joined = people.filter((p) => p.joined)
  const sharesDossier = (i: number) => !landedOf.has(i) && rand(seed, i, 21) < 0.35
  const landedOf = new Set(
    joined
      .filter((p) => (p.l === 0 ? rand(seed, p.i, 7) < 0.55 : p.l === 1 ? rand(seed, p.i, 7) < 0.25 : rand(seed, p.i, 7) < 0.05))
      .filter((p) => p.i !== featured && !p.extra)
      .map((p) => p.i),
  )
  // A distinct line per person who shares, fitted to their title (src/lib/workforce/demo-dossier-lines.ts).
  const sharedByTitle = new Map<string, number>()
  const dossierLine = new Map<number, string>()
  for (const p of joined) {
    if (!sharesDossier(p.i)) continue
    const n = sharedByTitle.get(p.title) ?? 0
    sharedByTitle.set(p.title, n + 1)
    dossierLine.set(p.i, dossierLineFor(p.title, n))
  }
  await prisma.candidateProfile.createMany({
    data: joined.map((p, k) => {
      const landed = landedOf.has(p.i)
      return {
        id: candId(p.i),
        userId: `${demoUserPrefix(slug)}${p.i}`,
        firstName: p.first,
        lastName: p.last,
        journey: p.extra ? p.extra.journey : p.i === featured ? 'LAID_OFF' : JOURNEYS[k % JOURNEYS.length],
        journeyStage: landed ? ('LANDED' as const) : p.i === featured ? ('APPLYING' as const) : p.extra?.kind === 'growing' ? ('EXPLORING' as const) : STAGES[Math.floor(rand(seed, p.i, 8) * STAGES.length) % STAGES.length],
        journeyChangedAt: p.joinedAt,
        journeyStageChangedAt: p.joinedAt,
        currentJobStatus: p.extra ? p.extra.status : landed ? ('EMPLOYED_CONSIDERING_MOVE' as const) : ('LAID_OFF' as const),
        // People moving here still live elsewhere.
        currentCity: p.extra?.kind === 'moving' ? pick(ELSEWHERE, seed, p.i, 23)[0] : town(p.i, 9).city,
        currentState: p.extra?.kind === 'moving' ? pick(ELSEWHERE, seed, p.i, 23)[1] : town(p.i, 9).state,
        // Two or so money pressures and a barrier each; most people name at least one.
        benefitsPressures: PRESSURES.filter((_, j) => rand(seed, p.i, 30 + j) < (p.extra?.kind === 'growing' ? 0.08 : 0.3)),
        biggestBarriers: BARRIERS.filter((_, j) => rand(seed, p.i, 40 + j) < 0.25),
        metroArea: localTowns[0].city,
        primaryFunction: PROFILES[p.title]?.fn ?? null,
        highestLevelReached: PROFILES[p.title]?.level ?? null,
        industryBucket: PROFILES[p.title]?.industry ?? null,
        yearsExperience: PROFILES[p.title]?.years ?? null,
        resumeKeywords: PROFILES[p.title]?.kw ?? [],
        positioningStatementText: dossierLine.get(p.i) ?? null,
        isSampleData: true,
      } satisfies Prisma.CandidateProfileCreateManyInput
    }),
  })
  // Learning plans: about half the group has added a course or two, mostly for the skills local employers ask for most.
  const PLAN_COURSES = [
    { title: 'Negotiation and sales skills for managers', provider: 'Coursera', w: 3 },
    { title: 'Leadership for managers', provider: 'Coursera', w: 2 },
    { title: 'Recruiting and talent acquisition basics', provider: 'LinkedIn Learning', w: 1 },
    { title: 'Lean Six Sigma green belt', provider: 'ASQ', w: 1 },
    { title: 'Customer experience fundamentals', provider: 'Coursera', w: 1 },
    { title: 'Python for operations', provider: 'Coursera', w: 1 },
  ]
  const weighted = PLAN_COURSES.flatMap((c) => Array.from({ length: c.w }, () => c))
  const planStatuses = ['PLANNED', 'STARTED', 'PLANNED', 'DONE']
  await prisma.learningPlanEntry.createMany({
    data: joined.flatMap((p) => {
      if (rand(seed, p.i, 61) > 0.5) return []
      const first = pick(weighted, seed, p.i, 62)
      const second = rand(seed, p.i, 63) < 0.3 ? pick(weighted, seed, p.i, 64) : null
      return [first, ...(second && second.title !== first.title ? [second] : [])].map((c, n) => ({
        id: `lp_${candId(p.i)}_${n}`,
        candidateId: candId(p.i),
        title: c.title,
        provider: c.provider,
        url: 'https://example.com/course',
        skills: skillsForTitle(c.title),
        status: planStatuses[Math.floor(rand(seed, p.i, 65 + n) * planStatuses.length)],
        slot: 'more',
        isSampleData: true,
      }))
    }),
    skipDuplicates: true,
  })
  await prisma.institutionMember.createMany({
    data: people.map((p) => ({
      id: memberId(p.i),
      institutionId,
      email: `${p.first}.${p.last}.${p.i}@example.com`.toLowerCase(),
      firstName: p.first,
      lastName: p.last,
      affiliation: 'PARTICIPANT' as const,
      matchMethod: 'MANUAL' as const,
      status: p.joined ? ('CLAIMED' as const) : ('INVITED' as const),
      claimedAt: p.joined ? p.joinedAt : null,
      lastKnownTitle: p.title,
      // Employed and growing: they work at a member company that enrolled its team (not a layoff).
      lastKnownEmployer: p.l >= 0 ? companies[layoffSpecs[p.l].company].name : p.extra?.kind === 'growing' ? companies[(p.i % 3) * 3 + 1].name : null,
      memberCompanyId: p.l >= 0 ? companies[layoffSpecs[p.l].company].id : null,
      rapidResponseId: p.l >= 0 ? layoffs[p.l].id : null,
      candidateId: p.joined ? candId(p.i) : null,
      isActiveSeat: true,
      seatActivatedAt: p.joinedAt,
      isSampleData: true,
      createdAt: p.joinedAt,
    })),
  })


  // Consent: most share their outcome; about a third share search detail.
  await prisma.institutionConsent.createMany({
    data: joined.flatMap((p) => [
      { memberId: memberId(p.i), scope: 'SHARE_OUTCOME' as const, granted: rand(seed, p.i, 10) < 0.88, source: 'CLAIM', isSampleData: true, changedAt: p.joinedAt },
      { memberId: memberId(p.i), scope: 'SHARE_SEARCH_DETAIL_WITH_CAREER' as const, granted: rand(seed, p.i, 11) < 0.35, source: 'CLAIM', isSampleData: true, changedAt: p.joinedAt },
      { memberId: memberId(p.i), scope: 'SHARE_DOSSIER_WITH_EMPLOYERS' as const, granted: sharesDossier(p.i), source: 'CLAIM', isSampleData: true, changedAt: p.joinedAt },
      // About six in ten let the program see the help they need, so it can match benefits.
      { memberId: memberId(p.i), scope: 'SHARE_NEEDS' as const, granted: p.i === featured || rand(seed, p.i, 24) < 0.6, source: 'CLAIM', isSampleData: true, changedAt: p.joinedAt },
    ]),
  })

  // Hires: mostly local, some remote, a few who moved away.
  await prisma.hireOutcome.createMany({
    data: [...landedOf].map((i) => {
      const r = rand(seed, i, 12)
      const where = r < 0.68 ? { workCity: town(i, 13).city, workState: town(i, 13).state, workRemote: false } : r < 0.84 ? { workCity: null, workState: null, workRemote: true } : (() => {
        const [c, s] = pick(ELSEWHERE, seed, i, 14)
        return { workCity: c, workState: s, workRemote: false }
      })()
      return {
        candidateId: candId(i),
        outcomeType: 'PERMANENT' as const,
        source: pick(['REFERRAL', 'INBOUND_APPLICATION', 'RECRUITER', 'NETWORK_CONVERSATION'] as const, seed, i, 15),
        hiredAt: new Date(now.getTime() - Math.floor(rand(seed, i, 16) * 30 + 5) * DAY),
        weeksUnemployedAtHire: 6 + Math.floor(rand(seed, i, 17) * 10),
        levelRetained: rand(seed, i, 18) < 0.7,
        isSampleData: true,
        ...where,
      }
    }),
  })

  // Activity this week for about half of those still searching.
  const searching = joined.filter((p) => !landedOf.has(p.i) && rand(seed, p.i, 19) < 0.55)
  await prisma.candidatePageActivityEvent.createMany({
    data: searching.flatMap((p) =>
      [0, 1].map((k) => ({ candidateId: candId(p.i), eventType: 'PAGE_VIEW' as const, path: k ? '/dashboard/find-my-job' : '/dashboard', createdAt: new Date(now.getTime() - Math.floor(rand(seed, p.i, 20 + k) * 6) * DAY) })),
    ),
  })

  // Coaches: upserted by email, so a reset keeps the same three.
  for (const [k, c] of DEMO_COACHES.entries()) {
    const workEmail = demoCoachEmail(slug, k)
    await prisma.coach.upsert({
      where: { workEmail },
      create: { ...c, workEmail, focus: 'CAREER', isSampleData: true, institutionId, certifications: ['ICF'], specializationTags: [], languages: ['English'] },
      update: { ...c, institutionId, isSampleData: true },
    })
  }

  // An AI retooling program with a running cohort.
  const program = await prisma.program.create({
    data: {
      institutionId,
      name: 'AI at Work: a 4-week course for mid-career professionals',
      summary: 'Use AI tools to do your current kind of job faster and better: research, writing, analysis and planning. Taught with a local college partner.',
      credential: 'AI-Ready Professional Certificate',
      skills: ['AI tools', 'Prompting', 'Data analysis', 'Automation'],
      hours: 24,
      credentialType: 'certificate',
      wioaEligible: true,
      createdBy: 'demo',
      isSampleData: true,
    },
    select: { id: true },
  })
  const cohort = await prisma.cohort.create({
    data: { programId: program.id, name: 'This month, online', startsAt: new Date(now.getTime() - 10 * DAY), endsAt: new Date(now.getTime() + 18 * DAY), seats: 60, modality: 'online', sessionsTotal: 8, minAttendancePct: 75, isSampleData: true },
    select: { id: true },
  })
  await prisma.enrollment.createMany({
    data: joined
      .filter((p) => !landedOf.has(p.i) && !p.extra)
      .slice(0, 22)
      .map((p, k) => ({ cohortId: cohort.id, memberId: memberId(p.i), status: 'ENROLLED' as const, payer: k % 3 === 0 ? ('WIOA_VOUCHER' as const) : ('SELF_PAY' as const), enrolledAt: new Date(now.getTime() - 10 * DAY), sessionsAttended: 2 + (k % 2), isSampleData: true })),
  })
  // Retraining beyond the layoffs: an employer pays for its growing staff, the board pays for career changers.
  await prisma.enrollment.createMany({
    data: joined
      .filter((p) => p.extra?.kind === 'growing' || p.extra?.kind === 'pivot')
      .map((p, k) => ({ cohortId: cohort.id, memberId: memberId(p.i), status: 'ENROLLED' as const, payer: p.extra?.kind === 'growing' ? ('EMPLOYER' as const) : ('WIOA_VOUCHER' as const), enrolledAt: new Date(now.getTime() - 10 * DAY), sessionsAttended: 2 + (k % 2), isSampleData: true })),
  })
  // The Education Hub's sample catalog, so Catalog, Assign and Gaps and coverage are filled in (src/lib/workforce/demo-training.ts).
  await prisma.trainingOffering.createMany({ data: demoTrainingOfferings(institutionId, localTowns[0]?.city ?? 'Your region') })
}


// Real towns inside the radius (Census places), the main city first.
async function townsNear(anchor: { lat: number; lon: number }, area: Awaited<ReturnType<typeof localArea>>, anchorCity: string, anchorState: string, radiusMiles: number) {
  const nearby = await prisma.geoPlace.findMany({
    where: {
      lat: { gte: anchor.lat - radiusMiles / 69, lte: anchor.lat + radiusMiles / 69 },
      lon: { gte: anchor.lon - radiusMiles / 50, lte: anchor.lon + radiusMiles / 50 },
      AND: [{ name: { not: { endsWith: 'CCD' } } }, { name: { not: { endsWith: 'township' } } }, { name: { not: { endsWith: 'precinct' } } }, { name: { not: { endsWith: 'CDP' } } }],
    },
    orderBy: { population: 'desc' },
    take: 40,
    select: { state: true, name: true, nameKey: true, lat: true, lon: true, county: true },
  })
  const towns = nearby
    .filter((p) => area?.keys.has(`${p.state}|${p.nameKey}`))
    .map((p) => ({ city: p.name.replace(/\/.*$/, '').replace(/\s+(city|town|village|borough|municipality)$/i, '').trim(), state: p.state }))
    .filter((t, i, all) => all.findIndex((x) => x.city === t.city && x.state === t.state) === i)
    .slice(0, 8)
  const localTowns = [{ city: anchorCity, state: anchorState }, ...towns.filter((t) => !(t.city.toLowerCase() === anchorCity.toLowerCase() && t.state === anchorState))]
  return { nearby, localTowns }
}

// Removes a demo org and its sample candidates. Only ever touches a demo.
export async function deleteWorkforceDemo(slug: string) {
  const inst = await prisma.institution.findFirst({ where: { slug, isDemo: true, isSampleData: true }, select: { id: true } })
  if (inst) await prisma.institution.delete({ where: { id: inst.id } })
  await prisma.coach.deleteMany({ where: { workEmail: { in: DEMO_COACHES.map((_, k) => demoCoachEmail(slug, k)) }, isSampleData: true } })
  await prisma.candidateProfile.deleteMany({ where: { userId: { startsWith: demoUserPrefix(slug) }, isSampleData: true } })
  await prisma.employerProfile.deleteMany({ where: { userId: { startsWith: demoUserPrefix(slug) }, isSampleData: true } })
}

// Nightly: public demos past their 30 days.
export async function cleanupExpiredDemos(now = new Date()) {
  const demos = await prisma.institution.findMany({ where: { isDemo: true, isSampleData: true, orgType: { not: 'COLLEGE' } }, select: { slug: true, enabledFeatures: true } })
  let removed = 0
  for (const d of demos) {
    const exp = (d.enabledFeatures as { demo?: { expiresAt?: string | null } } | null)?.demo?.expiresAt
    if (exp && new Date(exp) < now) {
      await deleteWorkforceDemo(d.slug)
      removed++
    }
  }
  return { removed }
}


// Fresh sample data for an existing workforce demo, keeping its address
// (a demo already sent to a prospect keeps working). Region data is kept.
export async function reseedWorkforceDemo(slug: string, now = new Date()) {
  const inst = await prisma.institution.findFirst({ where: { slug, isDemo: true, isSampleData: true, orgType: { not: 'COLLEGE' } }, select: { id: true, name: true, enabledFeatures: true } })
  if (!inst) return { error: 'Not a workforce demo.' }
  const local = (inst.enabledFeatures as { local?: LocalSettings } | null)?.local
  if (!local) return { error: 'This demo has no region.' }
  const anchor = await placeAt(local.anchorCity, local.anchorState)
  if (!anchor) return { error: 'The demo’s city is no longer in the place list.' }
  const area = await localArea(local)
  const { localTowns } = await townsNear(anchor, area, local.anchorCity, local.anchorState, local.radiusMiles)
  const id = inst.id
  await prisma.institutionEmployer.deleteMany({ where: { institutionId: id } })
  await prisma.institutionMember.deleteMany({ where: { institutionId: id } })
  await prisma.rapidResponse.deleteMany({ where: { institutionId: id } })
  await prisma.fundingPartnerCommitment.deleteMany({ where: { institutionId: id } })
  await prisma.partnerGroup.deleteMany({ where: { institutionId: id } })
  await prisma.fundingApplication.deleteMany({ where: { institutionId: id } })
  await prisma.partnerView.deleteMany({ where: { institutionId: id } })
  await prisma.ecosystemPartner.deleteMany({ where: { institutionId: id } })
  await prisma.featuredJob.deleteMany({ where: { institutionId: id } })
  await prisma.exclusiveJobPosting.deleteMany({ where: { institutionScopeId: id, OR: [{ addedBy: { startsWith: 'feed:' } }, { addedBy: { startsWith: 'employer:' } }] } })
  await prisma.groupJobFeed.deleteMany({ where: { institutionId: id } })
  await prisma.memberCompany.deleteMany({ where: { institutionId: id } })
  await prisma.program.deleteMany({ where: { institutionId: id } })
  await prisma.trainingOffering.deleteMany({ where: { institutionId: id } })
  await prisma.candidateProfile.deleteMany({ where: { userId: { startsWith: demoUserPrefix(slug) }, isSampleData: true } })
  await prisma.employerProfile.deleteMany({ where: { userId: { startsWith: demoUserPrefix(slug) }, isSampleData: true } })
  await seedWorkforceDemo({ institutionId: id, slug, seed: `${slug}:${now.toISOString().slice(0, 10)}`, now, localTowns, name: inst.name })
  return { ok: true }
}
