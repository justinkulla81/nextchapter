// A workforce demo, generated for any region: a workforce board, economic
// development org, chamber or community org types its name and main city
// and gets a working Program workspace in a minute.
//
// Real and public: the region (Census places within the radius), its
// workforce board and county unemployment (BLS), WARN notices, and real job
// postings near it. Fictional, every row isSampleData: the member
// companies, participants, their searches and hires. Demo orgs never email
// anyone (sendCampaign skips isDemo), and public demos expire after 30 days.

import 'server-only'
import { createHash } from 'crypto'
import type { InstitutionOrgType, JourneyStage, JourneyType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { localArea, placeAt, type LocalSettings } from './local'
import { countyKey, STATE_NAMES } from './places'

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
const JOURNEYS: JourneyType[] = ['LAID_OFF', 'LAID_OFF', 'LAID_OFF', 'READY_TO_MOVE', 'CAREER_CHANGE', 'LAID_OFF']
const STAGES: JourneyStage[] = ['EXPLORING', 'PREPARING', 'APPLYING', 'APPLYING', 'INTERVIEWING', 'INTERVIEWING', 'OFFER']
const DOSSIER_LINES = [
  'Operations manager who ran a 200-person distribution center; strongest at cutting cost without cutting service.',
  'Customer experience director who rebuilt a contact center around one number: first-call resolution.',
  'Financial analyst moving into FP&A; turns messy data into a budget people trust.',
  'Logistics supervisor who cut late shipments by a third; ready for a site lead role.',
  'HR business partner who led two reorganizations without losing a top performer.',
  'Software engineer with eight years in claims systems; wants a local product team.',
]
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
  // 'public' demos expire; 'admin' ones stay until deleted.
  source: 'public' | 'admin'
  requestedBy: string | null
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
  const radiusMiles = Math.min(Math.max(Math.round(input.radiusMiles ?? 40), 10), 100)
  const local: LocalSettings = { anchorCity, anchorState, radiusMiles, label: `the ${anchorCity} region` }
  const area = await localArea(local)

  // The region: the anchor's county (Census) and the workforce board that serves it.
  const { nearby, localTowns } = await townsNear(anchor, area, anchorCity, anchorState, radiusMiles)
  const anchorCounty = nearby.find((p) => p.state === anchorState && p.nameKey === anchorCity.toLowerCase())?.county ?? null
  const boards = await prisma.workforceBoard.findMany({ where: { state: anchorState }, select: { name: true, website: true, counties: true, placeCounties: true } })
  const board = anchorCounty ? boards.find((b) => [...b.counties, ...b.placeCounties].includes(countyKey(anchorCounty))) : null
  const counties = board ? [...new Set([...board.counties, ...board.placeCounties])].slice(0, 12) : anchorCounty ? [countyKey(anchorCounty)] : []
  const labor = counties.length
    ? await prisma.countyLabor.findMany({ where: { state: anchorState, nameKey: { in: counties } }, orderBy: { laborForce: 'desc' }, take: 4, select: { name: true, rate: true, period: true, laborForce: true } })
    : []

  const salt = createHash('sha256').update(`${name}|${now.toISOString()}|${Math.random()}`).digest('hex').slice(0, 5)
  const slug = slugFor(name, salt)
  const seed = slug
  const expiresAt = input.source === 'public' ? new Date(now.getTime() + PUBLIC_DEMO_DAYS * DAY) : null

  const profile = {
    tagline: `Keeping ${anchorCity}'s talent working in ${anchorCity}.`,
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
      accentColor: '#1f5f8b',
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
        demo: { source: input.source, requestedBy: input.requestedBy, createdAt: now.toISOString(), expiresAt: expiresAt?.toISOString() ?? null },
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
  for (const [k, c] of companies.entries()) {
    if (k % 3 !== 1 && k !== 5) continue
    const ep = await prisma.employerProfile.create({ data: { userId: `${demoUserPrefix(slug)}employer-${k}`, companyName: c.name, companyIndustry: COMPANIES[k].industry, contactName: 'Talent team', isSampleData: true }, select: { id: true } })
    await prisma.institutionEmployer.create({ data: { institutionId, employerProfileId: ep.id, status: 'APPROVED', approvedBy: 'member-invite', approvedAt: now, isSampleData: true } })
    await prisma.memberCompany.update({ where: { id: c.id }, data: { employerProfileId: ep.id, connectedAt: now, invitedEmail: `talent@${c.name.toLowerCase().replace(/[^a-z]+/g, '')}.example.com` } })
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

  // Participants: 150, mostly from the layoffs, some signed up directly.
  const N = 150
  const featured = 3
  const memberId = (i: number) => (i === featured ? `${slug}_member_featured` : `${slug}_m_${String(i).padStart(3, '0')}`)
  const candId = (i: number) => `${slug}_cand_${String(i).padStart(3, '0')}`
  const people = Array.from({ length: N }, (_, i) => {
    const l = i < 70 ? 0 : i < 115 ? 1 : i < 140 ? 2 : -1
    const spec = l >= 0 ? layoffSpecs[l] : null
    const joinedAt = spec ? new Date(now.getTime() - (spec.daysAgo - 2 - Math.floor(rand(seed, i, 2) * Math.min(spec.daysAgo - 3, 20))) * DAY) : new Date(now.getTime() - Math.floor(rand(seed, i, 2) * 90) * DAY)
    const joined = i === featured || rand(seed, i, 3) < 0.72
    return { i, l, joined, joinedAt, first: pick(FIRST, seed, i, 4), last: pick(LAST, seed, i, 5), title: pick(TITLES, seed, i, 6) }
  })
  // Joined: a sample candidate each, at a stage of their search; the oldest
  // layoff has the most people landed.
  const joined = people.filter((p) => p.joined)
  const sharesDossier = (i: number) => !landedOf.has(i) && rand(seed, i, 21) < 0.35
  const landedOf = new Set(
    joined
      .filter((p) => (p.l === 0 ? rand(seed, p.i, 7) < 0.55 : p.l === 1 ? rand(seed, p.i, 7) < 0.25 : rand(seed, p.i, 7) < 0.05))
      .filter((p) => p.i !== featured)
      .map((p) => p.i),
  )
  await prisma.candidateProfile.createMany({
    data: joined.map((p, k) => {
      const landed = landedOf.has(p.i)
      return {
        id: candId(p.i),
        userId: `${demoUserPrefix(slug)}${p.i}`,
        firstName: p.first,
        lastName: p.last,
        journey: p.i === featured ? 'LAID_OFF' : JOURNEYS[k % JOURNEYS.length],
        journeyStage: landed ? ('LANDED' as const) : p.i === featured ? ('APPLYING' as const) : STAGES[Math.floor(rand(seed, p.i, 8) * STAGES.length) % STAGES.length],
        journeyChangedAt: p.joinedAt,
        journeyStageChangedAt: p.joinedAt,
        currentJobStatus: landed ? ('EMPLOYED_CONSIDERING_MOVE' as const) : ('LAID_OFF' as const),
        currentCity: town(p.i, 9).city,
        currentState: town(p.i, 9).state,
        metroArea: localTowns[0].city,
        positioningStatementText: sharesDossier(p.i) ? pick(DOSSIER_LINES, seed, p.i, 22) : null,
        isSampleData: true,
      } satisfies Prisma.CandidateProfileCreateManyInput
    }),
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
      lastKnownEmployer: p.l >= 0 ? companies[layoffSpecs[p.l].company].name : null,
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
    data: { programId: program.id, name: 'This month, online', startsAt: new Date(now.getTime() - 10 * DAY), endsAt: new Date(now.getTime() + 18 * DAY), seats: 30, modality: 'online', sessionsTotal: 8, minAttendancePct: 75, isSampleData: true },
    select: { id: true },
  })
  await prisma.enrollment.createMany({
    data: joined
      .filter((p) => !landedOf.has(p.i))
      .slice(0, 22)
      .map((p, k) => ({ cohortId: cohort.id, memberId: memberId(p.i), status: 'ENROLLED' as const, payer: k % 3 === 0 ? ('WIOA_VOUCHER' as const) : ('SELF_PAY' as const), enrolledAt: new Date(now.getTime() - 10 * DAY), sessionsAttended: 2 + (k % 2), isSampleData: true })),
  })
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
  await prisma.memberCompany.deleteMany({ where: { institutionId: id } })
  await prisma.program.deleteMany({ where: { institutionId: id } })
  await prisma.candidateProfile.deleteMany({ where: { userId: { startsWith: demoUserPrefix(slug) }, isSampleData: true } })
  await prisma.employerProfile.deleteMany({ where: { userId: { startsWith: demoUserPrefix(slug) }, isSampleData: true } })
  await seedWorkforceDemo({ institutionId: id, slug, seed: `${slug}:${now.toISOString().slice(0, 10)}`, now, localTowns, name: inst.name })
  return { ok: true }
}
