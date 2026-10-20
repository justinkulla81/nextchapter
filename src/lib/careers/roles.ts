/**
 * Open roles shown on /careers. One typed list feeds the careers page, each
 * role page, the sitemap and the apply links, so a role is edited in one place.
 *
 * Before going live (see docs/hiring/DRAFT_job_postings_2026-10-20.md):
 *  - set `compensation` on every employee role (a pay range, or the structure
 *    stated plainly) — the page shows the line only when it is set;
 *  - have an employment lawyer review the wording, the internship terms and
 *    the equal-opportunity statement;
 *  - then set CAREERS_PAGE_LIVE=true. Until it is, /careers returns a 404.
 */

export type RoleKind = 'lead' | 'contributor' | 'platform'
export type RoleGroup = 'lead' | 'contributor' | 'early-career' | 'platform'

export interface CareerRole {
  slug: string
  title: string
  /** Lead: owns a function. Contributor: does the work inside one. Platform: not a job. */
  kind: RoleKind
  group: RoleGroup
  /** One-sentence summary shown on the list. */
  summary: string
  /** Who this role works with or sells to, when the role has a defined focus. */
  focus?: string[]
  responsibilities: string[]
  /** What the person already brings. */
  bring: string[]
  bonus?: string[]
  firstNinetyDays?: string[]
  /** Pay range or structure, stated plainly. Null until decided; never guessed. */
  compensation: string | null
  employment: 'Full-time' | 'Internship' | 'Associate program' | 'Platform'
  /** Job-board entry fields (admin → Job Board), so a listing can mirror this role. */
  boardFunction?: string
  boardLevel?: string
  /** Platform roles link out to the existing coach and recruiter pages. */
  externalHref?: string
}

export const CAREERS_LOCATION = 'New York City'

/** The careers pages stay dark (404) until this is set, so nothing posts before pay and wording are ready. */
export function careersPageLive(): boolean {
  return process.env.CAREERS_PAGE_LIVE === 'true'
}

export const KIND_LABEL: Record<RoleKind, string> = {
  lead: 'Lead',
  contributor: 'Contributor',
  platform: 'Platform, not a job',
}

export const KIND_EXPLAINER: Record<RoleKind, string> = {
  lead: 'You own this function and set its direction.',
  contributor: 'You do the work inside a function and work with its lead.',
  platform: 'You join the NextChapter platform. This is not an employment offer.',
}

export const GROUP_HEADING: Record<RoleGroup, { title: string; blurb: string }> = {
  lead: { title: 'Lead roles', blurb: 'You own a function and set its direction.' },
  contributor: { title: 'Contributor roles', blurb: 'You do the work inside a function and work with its lead.' },
  'early-career': { title: 'Early career', blurb: 'For students and new graduates starting out.' },
  platform: { title: 'Join the platform', blurb: 'Coaches and recruiters work with candidates through NextChapter. These are not jobs.' },
}

export const GROUP_ORDER: RoleGroup[] = ['lead', 'contributor', 'early-career', 'platform']

export const CAREER_VALUES: { title: string; body: string }[] = [
  { title: 'Emotional intelligence', body: 'You read people well, listen first, and stay steady with someone worried about their livelihood.' },
  { title: 'Proven knowledge', body: 'We care what you have done and learned, not where you studied or worked. Show us the work.' },
  { title: 'A point of view', body: 'You form an opinion, say it plainly, and change it when the evidence changes.' },
  { title: 'Reliability', body: 'You finish what you start, follow up, and keep your commitments.' },
  { title: 'Integrity', body: 'You tell the truth, including about numbers, claims and your own mistakes.' },
  { title: 'Ownership', body: 'You take responsibility for outcomes and find a way to get things done.' },
  { title: 'Optimism', body: 'You bring constructive energy to hard problems.' },
  { title: 'Creativity', body: 'You find a new angle when the standard one is not working.' },
  { title: 'Care about the problem', body: 'You are drawn to helping people through a hard career moment.' },
  { title: 'Teamwork with a view', body: 'You collaborate well and still disagree openly, then commit once we decide.' },
  { title: 'Comfort with AI (a plus)', body: 'We use AI for first drafts and research, and people for judgment and relationships.' },
]

export const HIRING_STEPS: string[] = [
  'A person reads every application. We do not use AI to screen or rank applicants.',
  'Every candidate gets the same structured questions, scored on the values above.',
  'We ask for a short work sample (about an hour) or a walk-through of work you already have. We do not pay for samples, and we never use them to get real work done.',
  'We do not filter on school or brand-name employers.',
]

export const EEO_STATEMENT =
  'NextChapter is an equal opportunity employer. We welcome applicants of every background. If you need an accommodation to apply or interview, tell us and we will work with you.'

export const CAREER_ROLES: CareerRole[] = [
  {
    slug: 'editorial-lead',
    title: 'Editorial lead',
    kind: 'lead',
    group: 'lead',
    summary: 'Own what NextChapter says in public: the monthly employment report, the website, the newsletter and marketing copy.',
    responsibilities: [
      'Edit and publish the monthly White Collar Employment Report: narrative, headline, brief and press angle.',
      'Own website copy: the homepage, pages for employers, recruiters, colleges, workforce boards and coaches, pricing, comparisons and FAQ.',
      'Own the monthly newsletter and marketing copy: emails, one-pagers, decks and case studies.',
      'Write and maintain the voice guide, and review work from other writers and from AI tools.',
      'Make sure every competitive claim has a source before it goes live.',
    ],
    bring: [
      'Published writing or editing with results you can point to.',
      'Strong judgment about accuracy, and comfort with data and charts.',
      'Experience with press, or with a B2B audience.',
      'Background as an editor, or a content or communications leader.',
    ],
    bonus: ['You already edit AI drafts well.'],
    firstNinetyDays: [
      'A short voice guide.',
      'Two report editions published.',
      'The five highest-traffic pages rewritten.',
    ],
    compensation: null,
    employment: 'Full-time',
    boardFunction: 'Marketing',
    boardLevel: 'DIRECTOR',
  },
  {
    slug: 'b2b-sales-lead',
    title: 'B2B sales lead',
    kind: 'lead',
    group: 'lead',
    summary: 'Build and run how NextChapter sells to workforce boards, colleges, outplacement providers and employers.',
    focus: ['Workforce boards', 'Higher education', 'Outplacement firms', 'Employers and HR teams'],
    responsibilities: [
      'Set the ideal customer profile and a 90-day pipeline goal with the founder.',
      'Run discovery, demos, proposals and paid pilots through to close.',
      'Work with marketing and partnerships on lead flow.',
      'Keep the CRM accurate and report pipeline weekly.',
    ],
    bring: [
      'A record of closing B2B deals with HR, talent, education or workforce buyers.',
      'Comfort selling a product that is still proving itself.',
      'Honest, clear forecasting.',
    ],
    bonus: ['You have sold outplacement, HR technology, higher-ed technology or workforce services.'],
    firstNinetyDays: [
      'A ranked target list.',
      'First demos booked.',
      'A first paid pilot proposal sent.',
    ],
    compensation: null,
    employment: 'Full-time',
    boardFunction: 'Sales',
    boardLevel: 'DIRECTOR',
  },
  {
    slug: 'sales-development-representative',
    title: 'Sales development representative',
    kind: 'contributor',
    group: 'contributor',
    summary: 'Research prospects, send outreach and book meetings for the B2B sales lead.',
    focus: ['Workforce boards', 'Higher education', 'Outplacement firms', 'Employers and HR teams'],
    responsibilities: [
      'Work the ranked lead list and personalize outreach. AI tools draft; you edit and send.',
      'Follow up on every reply and keep the CRM current.',
      'Book qualified meetings and hand them off with clear notes.',
    ],
    bring: [
      'Curiosity about the buyer and excellent written communication.',
      'Persistence without pestering.',
      'A habit of tracking your own results.',
    ],
    bonus: ['You are comfortable using AI to draft and research.'],
    firstNinetyDays: ['A steady weekly volume of outreach, with a measured reply rate and meetings booked.'],
    compensation: null,
    employment: 'Full-time',
    boardFunction: 'Sales',
    boardLevel: 'ENTRY',
  },
  {
    slug: 'partnerships-lead',
    title: 'Partnerships lead',
    kind: 'lead',
    group: 'lead',
    summary: 'Build relationships with workforce boards, colleges, outplacement providers, employers, and research and academic partners.',
    focus: ['Workforce boards', 'Higher education', 'Outplacement and employers', 'Research and academic partners'],
    responsibilities: [
      'Choose priority partners and run pilots with them.',
      'Bring coaches and recruiters onto the platform.',
      'Develop research partnerships tied to the monthly report.',
      'Work with the sales lead so partners and buyers are not approached twice.',
    ],
    bring: [
      'Experience building partnerships or alliances.',
      'Credibility with public, education or professional-services institutions.',
      'Patience with long sales cycles.',
    ],
    firstNinetyDays: [
      'A priority partner list.',
      'A first pilot conversation with a workforce board or college.',
      'The first group of coaches and recruiters onboarded.',
    ],
    compensation: null,
    employment: 'Full-time',
    boardFunction: 'Business Development',
    boardLevel: 'DIRECTOR',
  },
  {
    slug: 'product-lead',
    title: 'Product lead',
    kind: 'lead',
    group: 'lead',
    summary: 'Decide what we build next across the candidate platform and the employer, college, coach and recruiter products.',
    focus: ['Candidate product', 'B2B products'],
    responsibilities: [
      'Own the roadmap and a short, ranked priority list.',
      'Turn customer feedback and usage data into decisions.',
      'Work with the founder and engineering on priorities, privacy and trust.',
      'Define success measures and review them monthly.',
    ],
    bring: [
      'Software products you shipped, and the outcomes they produced.',
      'Strong user research and data habits.',
      'Judgment about privacy in a sensitive area.',
    ],
    bonus: ['You have built AI-assisted products.'],
    firstNinetyDays: [
      'A written roadmap.',
      'A prioritized fix list drawn from user feedback.',
      'Billing and checkout scoped with engineering.',
    ],
    compensation: null,
    employment: 'Full-time',
    boardFunction: 'Product',
    boardLevel: 'DIRECTOR',
  },
  {
    slug: 'technology-lead',
    title: 'Technology lead',
    kind: 'lead',
    group: 'lead',
    summary: 'Lead engineering and own how AI is used across the product and the company. Hands-on AI experience is required.',
    responsibilities: [
      'Own the technical direction of the platform, and keep it secure and reliable.',
      'Design, build and evaluate the AI features and AI agents that help run the product and the business.',
      'Set the standards for safety, privacy, cost and quality in every AI use.',
      'Build and mentor the engineering team as it grows.',
      'Work with the product lead to ship what matters.',
    ],
    bring: [
      'Hands-on experience building and shipping AI-powered software (required).',
      'Strong full-stack engineering, ideally TypeScript, React and Postgres.',
      'Judgment about evaluating AI output, controlling cost, and protecting sensitive data.',
      'Experience leading engineers, or readiness to.',
    ],
    firstNinetyDays: [
      'A review of the codebase, security and AI costs.',
      'Billing and checkout delivered or scheduled.',
      'A written standard for how AI is used and approved.',
    ],
    compensation: null,
    employment: 'Full-time',
    boardFunction: 'Engineering',
    boardLevel: 'DIRECTOR',
  },
  {
    slug: 'marketing-lead',
    title: 'Marketing lead',
    kind: 'lead',
    group: 'lead',
    summary: 'Own how NextChapter reaches employers, partners and candidates: LinkedIn, B2B campaigns, and the monthly newsletter outreach.',
    responsibilities: [
      'Run the LinkedIn calendar for the company and the founder.',
      'Plan and run B2B campaigns to the lead list, with the sales lead.',
      'Own newsletter operations: lists, segments, schedule, sends and unsubscribes.',
      'Take each monthly report to press, partners and the people who should read it.',
      'Report weekly on what worked, from visit to signup to meeting.',
    ],
    bring: [
      'A record of campaigns you ran, with results.',
      'Comfort with analytics and with testing.',
      'Care about accuracy in everything you publish.',
    ],
    bonus: ['You use AI tools to draft and research, and you know where they fail.'],
    firstNinetyDays: [
      'A steady posting cadence.',
      'Three tested B2B sequences.',
      'The newsletter sent on time each month, with a first attribution report.',
    ],
    compensation: null,
    employment: 'Full-time',
    boardFunction: 'Marketing',
    boardLevel: 'DIRECTOR',
  },
  {
    slug: 'internship',
    title: 'Intern',
    kind: 'contributor',
    group: 'early-career',
    summary: 'Work on a real project with one of our leads and learn how a small company runs.',
    responsibilities: [
      'Join one team (editorial, marketing, sales, partnerships, product or technology) and work on a defined project.',
      'Present what you learned and made at the end.',
    ],
    bring: [
      'Curiosity, good judgment and a habit of finishing what you start.',
      'Clear writing.',
      'No prior experience is required.',
    ],
    bonus: ['You are comfortable using AI tools.'],
    compensation: null,
    employment: 'Internship',
    boardFunction: 'Operations',
    boardLevel: 'ENTRY',
  },
  {
    slug: 'associate-program',
    title: 'Associate, new graduate program',
    kind: 'contributor',
    group: 'early-career',
    summary: 'A first full-time job for new college graduates, working alongside a lead on one team.',
    responsibilities: [
      'Join one team and work alongside its lead on real work.',
      'Learn the whole business, with regular time with the founder.',
      'Take on more ownership as you show what you can do.',
    ],
    bring: [
      'A recent college degree, or finishing one soon.',
      'Evidence of what you can do: projects, work, writing or leadership.',
      'The values listed on this page.',
    ],
    bonus: ['You are comfortable using AI tools.'],
    compensation: null,
    employment: 'Associate program',
    boardFunction: 'Operations',
    boardLevel: 'ENTRY',
  },
  {
    slug: 'coach',
    title: 'Coach on NextChapter',
    kind: 'platform',
    group: 'platform',
    summary: 'Join the coach platform and work with clients who come through NextChapter. This is not a job.',
    responsibilities: [
      'Receive pre-session briefs and note summaries, and book sessions through the platform.',
      'Set your own hours. Clients are introduced to you through the platform.',
    ],
    bring: [
      'Experience coaching mid-career or executive clients.',
      'Training or credentials you can describe.',
      'References.',
    ],
    compensation: null,
    employment: 'Platform',
    externalHref: '/coaches',
  },
  {
    slug: 'recruiter',
    title: 'Recruiter on NextChapter',
    kind: 'platform',
    group: 'platform',
    summary: 'Join the recruiter portal and meet candidates who choose to be visible to recruiters. This is not a job.',
    responsibilities: [
      'Search for candidates, post roles to the job board and calibrate searches with candidates.',
    ],
    bring: [
      'An active search practice.',
      'A record of ethical, candidate-first work.',
      'References.',
    ],
    compensation: null,
    employment: 'Platform',
    externalHref: '/recruiters',
  },
]

export function getRole(slug: string): CareerRole | undefined {
  return CAREER_ROLES.find((r) => r.slug === slug)
}

export function rolesInGroup(group: RoleGroup): CareerRole[] {
  return CAREER_ROLES.filter((r) => r.group === group)
}
