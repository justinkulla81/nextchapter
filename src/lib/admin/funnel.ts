import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { BOT_SIGNATURES } from '@/lib/http/user-agent'
import { homeAbOn, visitorsPerArm } from '@/lib/home-ab'

// Admin funnel: traffic -> email/journey -> registration -> onboarding -> résumé
// -> activation -> engagement -> Candidate+ -> hired.
//
// Two different populations, kept separate on purpose:
//  - Traffic stages count anonymous visitors (distinct IP, human user agents only, same
//    dedupe the Visitors report uses) and lead rows, by the date the event happened.
//  - Member stages are a COHORT: profiles created in the window, followed through every
//    later step to today. A step is "reached ever", so a member who signed up 3 days ago
//    has had less time to reach later steps than one from 30 days ago.
// The two are not one pipeline (visitors carry no id until they register), so the page
// shows them as two bands and says so.

export type FunnelWindowDays = 7 | 30 | 90

export interface FunnelStage {
  key: string
  label: string
  /** What counts as having reached this step, in plain words. */
  definition: string
  count: number
}

export interface FunnelData {
  windowDays: FunnelWindowDays
  since: Date
  traffic: FunnelStage[]
  members: FunnelStage[]
  leadsByKind: { kind: string; count: number }[]
  leadsBySource: { source: string; count: number }[]
  landing: { path: string; visitors: number; leadsSameSource: number }[]
  offers: OfferRow[]
  b2b: B2bRow[]
  homeTest: HomeTestData
}

export interface B2bRow {
  key: string
  label: string
  /** Where the audience lands, in words. */
  where: string
  /** Distinct visitors to those pages. */
  reached: number
  /** People or organizations who raised a hand, summed over the forms below. */
  raisedHand: number
  /** The forms that count, so the number is never read as something else. */
  counts: string
}

export interface OfferRow {
  key: string
  label: string
  /** Where people see it, in words. */
  where: string
  /** Distinct people who saw the page (or, for Market Reality, clicked the start link). */
  reached: number
  /** What they gave: an email, a file or a started account. */
  captured: number
  /** What the capture is, so a count is never read as a different thing. */
  capturedMeans: string
  /** Of those who gave an email, how many later registered (counted from the registration event; null where it does not apply). */
  becameMembers: number | null
}

// Which offer a lead belongs to, from its kind and source (HomepageLead). Mirrors the rows in computeOffers.
function offerKeyForLead(kind: string, source: string): string | null {
  if (kind === 'journey') return source.startsWith('network:') ? 'network' : 'journey'
  if (kind === 'job_alert') {
    if (source === 'page:employer') return 'alertEmployer'
    if (source === 'page:title') return 'alertTitle'
    if (source === 'page:salary') return 'alertTitle'
    if (source === 'page:place') return 'alertPlace'
    return 'jobSearch'
  }
  if (kind === 'apply_save') return 'jobSave'
  if (kind === 'layoff_alert' || kind === 'layoff_employer') return 'layoffAlert'
  if (kind === 'deadline_reminders') return source.startsWith('cobra_vs_aca') ? 'cobra' : 'tools'
  return null
}

const botPatterns = BOT_SIGNATURES.map((s) => `%${s}%`)

function humanOnly(): Prisma.Sql {
  // Rows with no user agent are excluded, matching the Visitors report (unknown is not human).
  return Prisma.sql`"userAgent" IS NOT NULL AND NOT ("userAgent" ILIKE ANY(${botPatterns}))`
}

async function countRaw(query: Prisma.Sql): Promise<number> {
  const rows = await prisma.$queryRaw<{ n: bigint }[]>(query)
  return Number(rows[0]?.n ?? 0)
}

// Distinct human visitors who viewed a page whose path matches the regex.
function reachedByPath(since: Date, pathRegex: string): Promise<number> {
  return countRaw(Prisma.sql`
    SELECT COUNT(DISTINCT "ip")::bigint AS n FROM "HomepageVisitEvent"
    WHERE "eventType" = 'PAGE_VIEW' AND "ip" IS NOT NULL AND "path" ~ ${pathRegex}
      AND "createdAt" >= ${since} AND ${humanOnly()}`)
}

export interface HomeTestArm {
  variant: 'a' | 'b'
  label: string
  visitors: number
  /** Viewed a second page. */
  multiPage: number
  /** Clicked a link to the Market Reality start page. */
  clickedStart: number
  /** Left an email on the journey picker. */
  gaveEmail: number
}

export interface HomeTestData {
  on: boolean
  arms: HomeTestArm[]
  /** Visitors each arm needs to see the start-click rate double, from the control's own rate (5% assumed until it has a click). */
  perArmToSeeDouble: number | null
}

// The homepage test (src/lib/home-ab.ts): each assigned visitor's homepage views carry their variant in `href`. Arms are
// joined to clicks, pages and leads by IP, the same identity the rest of this page uses. An IP seen in both arms (a shared
// network, or a cleared cookie) counts in both; at this traffic that is a handful at most.
async function computeHomeTest(since: Date): Promise<HomeTestData> {
  const rows = await prisma.$queryRaw<{ v: string; visitors: bigint; multi: bigint; clicked: bigint; emailed: bigint }[]>(Prisma.sql`
    WITH arm AS (
      SELECT DISTINCT "ip", substring("href" from 9 for 1) AS v FROM "HomepageVisitEvent"
      WHERE "eventType" = 'PAGE_VIEW' AND "ip" IS NOT NULL AND "href" IN ('ab:home:a', 'ab:home:b')
        AND "createdAt" >= ${since} AND ${humanOnly()}
    )
    SELECT arm.v AS v,
      COUNT(*)::bigint AS visitors,
      COUNT(*) FILTER (WHERE (SELECT COUNT(DISTINCT e."path") FROM "HomepageVisitEvent" e
        WHERE e."ip" = arm."ip" AND e."eventType" = 'PAGE_VIEW' AND e."path" IS NOT NULL AND e."createdAt" >= ${since}) >= 2)::bigint AS multi,
      COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "HomepageVisitEvent" e
        WHERE e."ip" = arm."ip" AND e."eventType" = 'LINK_CLICK' AND e."href" LIKE '%/onboarding/desire%' AND e."createdAt" >= ${since}))::bigint AS clicked,
      COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "HomepageLead" l
        WHERE l."ip" = arm."ip" AND l."kind" = 'journey' AND l."createdAt" >= ${since}))::bigint AS emailed
    FROM arm GROUP BY arm.v`)
  const by = new Map(rows.map((r) => [r.v, r]))
  const arm = (variant: 'a' | 'b', label: string): HomeTestArm => {
    const r = by.get(variant)
    return { variant, label, visitors: Number(r?.visitors ?? 0), multiPage: Number(r?.multi ?? 0), clickedStart: Number(r?.clicked ?? 0), gaveEmail: Number(r?.emailed ?? 0) }
  }
  const arms = [arm('a', 'A · Control (current homepage)'), arm('b', 'B · Journey picker in the hero')]
  const control = arms[0]
  const rate = control.visitors > 0 && control.clickedStart > 0 ? control.clickedStart / control.visitors : 0.05
  const need = visitorsPerArm(rate, 1)
  return { on: homeAbOn(), arms, perArmToSeeDouble: Number.isFinite(need) ? need : null }
}

async function computeB2b(since: Date): Promise<B2bRow[]> {
  const win = { createdAt: { gte: since } }
  const contacts = (sources: string[]) => prisma.contactSubmission.count({ where: { ...win, source: { in: sources } } })
  const [rEmp, rGov, rHigher, rRec, rOrg, cEmp, cGov, cHigher, cRec, cOrg, waitlist, demos, claims, recruiters] = await Promise.all([
    reachedByPath(since, '^/((employers|talent|employees)/?(\\?.*)?$|outplacement)'),
    reachedByPath(since, '^/(government-workforce|workforce-boards|rapid-response|job-centers/?(\\?.*)?$|economic-development/?(\\?.*)?$)'),
    reachedByPath(since, '^/higher-education/?(\\?.*)?$'),
    reachedByPath(since, '^/(recruiters|in/|search-firms/?(\\?.*)?$)'),
    reachedByPath(since, '^/(for-organizations|nonprofits/?(\\?.*)?$|coaches)'),
    contacts(['employers', 'talent', 'outplacement', 'employees', 'asset:outplacement-rfp-kit']),
    contacts(['government-workforce', 'asset:workforce-demo']),
    contacts(['higher-education']),
    contacts(['recruiters']),
    contacts(['organizations', 'nonprofits', 'coaches']),
    prisma.waitlistSignup.count({ where: { ...win, audience: 'Employer' } }),
    prisma.institution.count({ where: { ...win, isDemo: true, orgType: { not: 'COLLEGE' } } }),
    prisma.orgClaim.count({ where: win }),
    prisma.recruiter.count({ where: win }),
  ])
  return [
    { key: 'employers', label: 'Employers and HR', where: '/employers, /outplacement, /talent, /employees', reached: rEmp, raisedHand: cEmp + waitlist, counts: 'contact messages and template requests, employer waitlist (employer accounts are left out: 12 were created in two days in October, not by visitors)' },
    { key: 'workforce', label: 'Workforce boards and government', where: '/government-workforce, /workforce-boards/*, rapid response, job centers', reached: rGov, raisedHand: cGov + demos + claims, counts: 'contact messages, demos built, page claims' },
    { key: 'higher', label: 'Higher education', where: '/higher-education', reached: rHigher, raisedHand: cHigher, counts: 'contact messages (page claims are in the workforce row)' },
    { key: 'recruiters', label: 'Recruiters and search firms', where: '/recruiters, /search-firms', reached: rRec, raisedHand: cRec + recruiters, counts: 'contact messages, new recruiter accounts' },
    { key: 'orgs', label: 'Other organizations', where: '/for-organizations, /nonprofits, /coaches', reached: rOrg, raisedHand: cOrg, counts: 'contact messages' },
  ]
}

async function computeOffers(since: Date, registered: number): Promise<OfferRow[]> {
  const win = { createdAt: { gte: since } }
  const lead = (where: object) => prisma.homepageLead.count({ where: { ...win, ...where } })
  const [
    marketRealityClicks, rHome, rJobs, rJobPage, rLayoffs, rResume, rGuides, rTools, rNews, rNetwork,
    cJourney, cJobAlert, cApplySave, cLayoff, cDeadline, cResume, cGuide, cNews, cNetwork,
    rEmployer, rTitle, rPlace, cAlertEmployer, cAlertTitle, cAlertPlace, memberEvents, rCobra, cCobra,
  ] = await Promise.all([
    countRaw(Prisma.sql`
      SELECT COUNT(DISTINCT "ip")::bigint AS n FROM "HomepageVisitEvent"
      WHERE "eventType" = 'LINK_CLICK' AND "ip" IS NOT NULL AND "href" LIKE '%/onboarding/desire%'
        AND "createdAt" >= ${since} AND ${humanOnly()}`),
    reachedByPath(since, '^/$'),
    reachedByPath(since, '^/jobs$'),
    reachedByPath(since, '^/jobs/[a-z0-9]{20,}$'),
    reachedByPath(since, '^/layoffs'),
    reachedByPath(since, '^/submit-resume'),
    reachedByPath(since, '^/resources/'),
    reachedByPath(since, '^/tools/'),
    reachedByPath(since, '^/(news|how-it-works|why-stuck)'),
    reachedByPath(since, '^/network/'),
    lead({ kind: 'journey', NOT: { source: { startsWith: 'network:' } } }),
    lead({ kind: 'job_alert', source: { notIn: ['page:employer', 'page:title', 'page:salary', 'page:place'] } }),
    lead({ kind: 'apply_save' }),
    lead({ kind: { in: ['layoff_alert', 'layoff_employer'] } }),
    lead({ kind: 'deadline_reminders', NOT: { source: { startsWith: 'cobra_vs_aca' } } }),
    prisma.resumeSubmissionLead.count({ where: win }),
    prisma.guideLead.count({ where: win }),
    prisma.newsletterSubscriber.count({ where: win }),
    lead({ kind: 'journey', source: { startsWith: 'network:' } }),
    reachedByPath(since, '^/employers/[^/]+$'),
    reachedByPath(since, '^/(jobs/title|salaries)/[^/]+$'),
    reachedByPath(since, '^/places/[^/]+/city/[^/]+$'),
    lead({ kind: 'job_alert', source: 'page:employer' }),
    lead({ kind: 'job_alert', source: { in: ['page:title', 'page:salary'] } }),
    lead({ kind: 'job_alert', source: 'page:place' }),
    prisma.$queryRaw<{ kind: string | null; source: string | null; n: bigint }[]>(Prisma.sql`
      SELECT "properties"->>'kind' AS kind, "properties"->>'source' AS source, COUNT(*)::bigint AS n
      FROM "AnalyticsEvent" WHERE "event" = 'lead_became_member' AND "createdAt" >= ${since}
      GROUP BY 1, 2`),
    reachedByPath(since, '^/(resources/cobra-aca|tools/cobra-vs-aca-calculator)'),
    lead({ kind: 'deadline_reminders', source: { startsWith: 'cobra_vs_aca' } }),
  ])
  const members = new Map<string, number>()
  for (const m of memberEvents) {
    const key = offerKeyForLead(m.kind ?? '', m.source ?? '')
    if (key) members.set(key, (members.get(key) ?? 0) + Number(m.n))
  }
  const mem = (key: string) => members.get(key) ?? 0
  return [
    { key: 'marketReality', label: 'Market Reality Assessment', where: 'Homepage, funding, how-it-works buttons to /onboarding/desire', reached: marketRealityClicks, captured: registered, capturedMeans: 'accounts registered in the window, from any route', becameMembers: null },
    { key: 'journey', label: 'Journey picker + first-week plan', where: 'Homepage "Where are you in your search?"', reached: rHome, captured: cJourney, capturedMeans: 'emails', becameMembers: mem('journey') },
    { key: 'jobSearch', label: 'Saved job search', where: '/jobs', reached: rJobs, captured: cJobAlert, capturedMeans: 'emails', becameMembers: mem('jobSearch') },
    { key: 'jobSave', label: 'Save this job', where: 'Job detail pages', reached: rJobPage, captured: cApplySave, capturedMeans: 'emails', becameMembers: mem('jobSave') },
    { key: 'layoffAlert', label: 'Layoff alerts', where: '/layoffs', reached: rLayoffs, captured: cLayoff, capturedMeans: 'emails', becameMembers: mem('layoffAlert') },
    { key: 'cobra', label: 'COBRA vs ACA pages', where: '/resources/cobra-aca (explainer and 51 state pages) and /tools/cobra-vs-aca-calculator', reached: rCobra, captured: cCobra, capturedMeans: 'emails (deadline reminders asked for on these pages)', becameMembers: mem('cobra') },
    { key: 'tools', label: 'Tools: deadline reminders', where: '/tools/*', reached: rTools, captured: cDeadline, capturedMeans: 'emails (reminders only; the calculators need no email)', becameMembers: mem('tools') },
    { key: 'guides', label: 'Guide downloads', where: '/resources/*', reached: rGuides, captured: cGuide, capturedMeans: 'emails', becameMembers: mem('guides') },
    { key: 'resumeRecruiters', label: 'Résumé to recruiters', where: '/submit-resume', reached: rResume, captured: cResume, capturedMeans: 'résumés (not the same offer as Market Reality)', becameMembers: mem('resumeRecruiters') },
    { key: 'newsletter', label: 'Newsletter and report downloads', where: 'News, how-it-works, report pop-ups', reached: rNews, captured: cNews, capturedMeans: 'emails', becameMembers: mem('newsletter') },
    { key: 'alertEmployer', label: 'Employer page job alerts', where: '/employers/*', reached: rEmployer, captured: cAlertEmployer, capturedMeans: 'emails', becameMembers: mem('alertEmployer') },
    { key: 'alertTitle', label: 'Job-title and salary page alerts', where: '/jobs/title/* and /salaries/*', reached: rTitle, captured: cAlertTitle, capturedMeans: 'emails', becameMembers: mem('alertTitle') },
    { key: 'alertPlace', label: 'City page job alerts', where: '/places/*/city/*', reached: rPlace, captured: cAlertPlace, capturedMeans: 'emails', becameMembers: mem('alertPlace') },
    { key: 'network', label: 'Network company pages', where: '/network/company/*', reached: rNetwork, captured: cNetwork, capturedMeans: 'emails', becameMembers: mem('network') },
  ]
}

export async function computeFunnel(windowDays: FunnelWindowDays): Promise<FunnelData> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)

  const [visitors, multiPage, leadEmails, landingRows, leadKinds, leadSources] = await Promise.all([
    countRaw(Prisma.sql`
      SELECT COUNT(DISTINCT "ip")::bigint AS n FROM "HomepageVisitEvent"
      WHERE "eventType" = 'PAGE_VIEW' AND "ip" IS NOT NULL AND "createdAt" >= ${since} AND ${humanOnly()}`),
    countRaw(Prisma.sql`
      SELECT COUNT(*)::bigint AS n FROM (
        SELECT "ip" FROM "HomepageVisitEvent"
        WHERE "eventType" = 'PAGE_VIEW' AND "ip" IS NOT NULL AND "path" IS NOT NULL
          AND "createdAt" >= ${since} AND ${humanOnly()}
        GROUP BY "ip" HAVING COUNT(DISTINCT "path") >= 2
      ) t`),
    countRaw(Prisma.sql`
      SELECT COUNT(DISTINCT LOWER("email"))::bigint AS n FROM "HomepageLead"
      WHERE "createdAt" >= ${since}`),
    prisma.$queryRaw<{ path: string; visitors: bigint }[]>(Prisma.sql`
      SELECT first_path AS path, COUNT(*)::bigint AS visitors FROM (
        SELECT DISTINCT ON ("ip") "ip", "path" AS first_path FROM "HomepageVisitEvent"
        WHERE "eventType" = 'PAGE_VIEW' AND "ip" IS NOT NULL AND "path" IS NOT NULL
          AND "createdAt" >= ${since} AND ${humanOnly()}
        ORDER BY "ip", "createdAt" ASC
      ) f GROUP BY first_path ORDER BY visitors DESC LIMIT 15`),
    prisma.homepageLead.groupBy({ by: ['kind'], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.homepageLead.groupBy({ by: ['source'], where: { createdAt: { gte: since } }, _count: { _all: true } }),
  ])

  // Member cohort: registered profiles created in the window. Anonymous (never registered)
  // profiles are counted as "started" only, so the registration drop-off is visible.
  const cohortWhere = { createdAt: { gte: since } }
  const registeredWhere = { ...cohortWhere, registrationCompletedAt: { not: null } }
  const [started, registered, onboarded, withResume, activated, engaged, plus, hired] = await Promise.all([
    prisma.candidateProfile.count({ where: cohortWhere }),
    prisma.candidateProfile.count({ where: registeredWhere }),
    prisma.candidateProfile.count({ where: { ...registeredWhere, introCommittedAt: { not: null } } }),
    prisma.candidateProfile.count({ where: { ...registeredWhere, introCommittedAt: { not: null }, resumes: { some: {} } } }),
    prisma.candidateProfile.count({
      where: {
        ...registeredWhere,
        introCommittedAt: { not: null },
        resumes: { some: {} },
        trackedJobs: { some: { OR: [{ savedAt: { not: null } }, { firstClickedAt: { not: null } }] } },
      },
    }),
    countRaw(Prisma.sql`
      SELECT COUNT(*)::bigint AS n FROM "CandidateProfile" p
      WHERE p."createdAt" >= ${since} AND p."registrationCompletedAt" IS NOT NULL AND p."introCommittedAt" IS NOT NULL
        AND (SELECT COUNT(*) FROM "CandidateVisitDay" v WHERE v."candidateId" = p."id") >= 3
        AND EXISTS (SELECT 1 FROM "Resume" r WHERE r."candidateId" = p."id")
        AND EXISTS (SELECT 1 FROM "TrackedJob" t WHERE t."candidateId" = p."id" AND (t."savedAt" IS NOT NULL OR t."firstClickedAt" IS NOT NULL))`),
    prisma.candidateProfile.count({
      where: {
        ...registeredWhere,
        candidatePlusUnlockedAt: { not: null },
        candidatePlusRevokedAt: null,
      },
    }),
    prisma.candidateProfile.count({ where: { ...registeredWhere, hireOutcomes: { some: {} } } }),
  ])

  const [offers, b2b, homeTest] = await Promise.all([computeOffers(since, registered), computeB2b(since), computeHomeTest(since)])

  const landing = landingRows.map((r) => ({
    path: r.path,
    visitors: Number(r.visitors),
    leadsSameSource: leadSources
      .filter((s) => s.source === leadSourceForPath(r.path))
      .reduce((n, s) => n + s._count._all, 0),
  }))

  return {
    windowDays,
    since,
    traffic: [
      { key: 'visitors', label: 'Visitors', definition: 'Distinct people (by IP) with a human page view', count: visitors },
      { key: 'multiPage', label: 'Looked at 2+ pages', definition: 'Same visitors who viewed at least two different pages', count: multiPage },
      { key: 'lead', label: 'Gave email or journey', definition: 'Distinct emails left on a journey or saved-search box', count: leadEmails },
    ],
    members: [
      { key: 'started', label: 'Started an account', definition: 'Profiles created in the window (includes anonymous)', count: started },
      { key: 'registered', label: 'Registered', definition: 'Finished creating a permanent account', count: registered },
      { key: 'onboarded', label: 'Onboarded', definition: 'Finished the welcome page and committed', count: onboarded },
      { key: 'resume', label: 'Gave a résumé', definition: 'Onboarded and uploaded at least one résumé', count: withResume },
      { key: 'activated', label: 'Activated', definition: 'Onboarded, résumé in, and saved or opened at least one job', count: activated },
      { key: 'engaged', label: 'Engaged', definition: 'Activated and came back on 3 or more different days', count: engaged },
      { key: 'plus', label: 'Candidate+', definition: 'Unlocked Candidate+ and not revoked (any route, not only engaged members)', count: plus },
      { key: 'hired', label: 'Got a job', definition: 'Reported a hire outcome', count: hired },
    ],
    leadsByKind: leadKinds.map((k) => ({ kind: k.kind, count: k._count._all })).sort((a, b) => b.count - a.count),
    leadsBySource: leadSources
      .map((s) => ({ source: s.source, count: s._count._all }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15),
    landing,
    offers,
    b2b,
    homeTest,
  }
}

// HomepageLead.source is 'home' | 'jobs' | 'start' | 'network:<type>:<slug>'. Only the three
// plain pages map cleanly to a landing path; everything else reports 0 here and is read from
// the lead-source table instead.
function leadSourceForPath(path: string): string | null {
  if (path === '/') return 'home'
  if (path === '/jobs') return 'jobs'
  if (path === '/start') return 'start'
  return null
}
