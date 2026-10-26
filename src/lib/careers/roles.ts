/**
 * Open roles shown on /careers. One typed list feeds the careers pages, the apply form and the
 * plain-text description (role-description.ts) that the platform's own job parsers read.
 *
 * Each role says what the person needs to know (knowledge, skills, tools), what they will do
 * (responsibilities) and how they work (howYouWork), with seniority and years stated the way a
 * job posting states them, so the same matching used for other jobs can read it.
 * roles.test.ts holds every role to that: skills must be terms the platform recognizes, and the
 * matching title must read as the declared function and seniority.
 */

export type RoleKind = 'lead' | 'contributor' | 'platform'
export type RoleGroup = 'editorial' | 'sales' | 'partnerships' | 'product' | 'technology' | 'marketing' | 'early-career' | 'platform'
export type RoleRung = 'DIRECTOR' | 'SENIOR_IC' | 'ENTRY_IC' | 'OTHER'

export interface CareerRole {
  slug: string
  /** The title shown on the page. Plain, and says Lead or Contributor in the badge. */
  title: string
  /**
   * The conventional title the platform's matching reads (it reads "Editorial lead" as a senior individual
   * contributor, and "Director of Content" as a director). Also the title to use if the role is posted to the job board.
   */
  matchTitle: string
  kind: RoleKind
  group: RoleGroup
  employment: 'Full-time' | 'Internship' | 'Associate program' | 'Platform'
  /** One sentence for the list. */
  summary: string
  /** Two or three sentences of context for the role. */
  about: string
  /** Seniority in words: who the role reports to, whether it leads people, comparable titles. */
  seniority: string
  /** The platform's job function for this role (what inferFunctionFromTitle returns for matchTitle), or null. */
  function: string | null
  /** The platform's seniority rung for matchTitle. */
  rung: RoleRung
  /** Minimum years of relevant experience, stated in the qualifications. Null for entry roles. */
  yearsMin: number | null
  /** Who the role works with or sells to, when the role has a defined focus. */
  focus?: string[]
  /** What you will do. */
  responsibilities: string[]
  /** Required qualifications. The first states the years of experience. */
  required: string[]
  preferred: string[]
  /** Skills and tools, every one a term the platform's skill extractor recognizes. */
  skills: string[]
  /** Domain knowledge in plain words, beyond the named skills. */
  knowledge: string[]
  /** How you work: the behaviors this role needs day to day. */
  howYouWork: string[]
  firstNinetyDays?: string[]
  /** Platform roles link out to the existing coach and recruiter pages. */
  externalHref?: string
}

export const CAREERS_LOCATION = 'New York City, or remote'

/** The day these openings were first published. Changes only when a role is reposted. */
export const CAREERS_POSTED = '2026-10-26'

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

export const GROUP_HEADING: Record<RoleGroup, string> = {
  editorial: 'Editorial',
  sales: 'Sales',
  partnerships: 'Partnerships',
  product: 'Product',
  technology: 'Technology',
  marketing: 'Marketing',
  'early-career': 'Early career',
  platform: 'Join the platform',
}

export const GROUP_ORDER: RoleGroup[] = ['editorial', 'sales', 'partnerships', 'product', 'technology', 'marketing', 'early-career', 'platform']

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

const BUYERS = ['Workforce boards', 'Higher education institutions', 'Outplacement firms', 'Employers and HR teams']

export const CAREER_ROLES: CareerRole[] = [
  {
    slug: 'editorial-lead',
    title: 'Editorial lead',
    matchTitle: 'Director of Content',
    kind: 'lead',
    group: 'editorial',
    employment: 'Full-time',
    summary: 'Own what NextChapter says in public: the monthly employment report, the website, the newsletter and marketing copy.',
    about:
      'NextChapter publishes a monthly White Collar Employment Report and speaks to candidates, employers, colleges and workforce boards. The editorial lead decides what we say, how it sounds and whether it is true, across the report, the website, the newsletter and marketing copy.',
    seniority: 'Senior leader. Owns the editorial function and reports to the founder. Edits other writers and AI-drafted copy. Comparable titles: Director of Content, Head of Editorial.',
    function: 'Marketing',
    rung: 'DIRECTOR',
    yearsMin: 8,
    responsibilities: [
      'Edit and publish the monthly White Collar Employment Report: narrative, headline, brief and press angle.',
      'Own website copy: the homepage, pages for employers, recruiters, colleges, workforce boards and coaches, pricing, comparisons and FAQ.',
      'Own the monthly newsletter and marketing copy: emails, one-pagers, decks and case studies.',
      'Write and maintain the voice guide, and review work from other writers and from AI tools.',
      'Make sure every competitive claim has a source before it goes live.',
    ],
    required: [
      '8+ years of experience writing or editing for publication, with results you can point to.',
      'Strong judgment about accuracy, and comfort reading data and charts.',
      'A portfolio of published work.',
      'Everyday use of AI tools for drafting and research, and the judgment to edit and fact-check what they produce.',
    ],
    preferred: [
      'Experience with press, or with a B2B audience.',
      'Experience in labor-market, HR or education writing.',
      'You already edit AI drafts well.',
    ],
    skills: ['content strategy', 'brand strategy', 'seo', 'google analytics', 'stakeholder management'],
    knowledge: ['Editorial standards and fact-checking', 'Reading labor-market and survey data', 'Writing for HR, education and workforce audiences'],
    howYouWork: [
      'You hold a high bar on accuracy and say so when a claim is not supported.',
      'You give clear, specific edits and take them yourself without ego.',
      'You work with data and engineers without needing translation.',
    ],
    firstNinetyDays: ['A short voice guide.', 'Two report editions published.', 'The five highest-traffic pages rewritten.'],
  },
  {
    slug: 'b2b-sales-lead',
    title: 'B2B sales lead',
    matchTitle: 'Director of Sales',
    kind: 'lead',
    group: 'sales',
    employment: 'Full-time',
    summary: 'Build and run how NextChapter sells to workforce boards, colleges, outplacement providers and employers.',
    about:
      'NextChapter sells to organizations that support people through layoffs and career change. The sales lead builds the process from the ground up: who to sell to, how to run a pilot, and how to close.',
    seniority: 'Senior leader. Owns the sales function and its number, reports to the founder, and will hire and manage the sales development rep. Comparable titles: Director of Sales, Head of Sales.',
    function: 'Sales',
    rung: 'DIRECTOR',
    yearsMin: 8,
    focus: BUYERS,
    responsibilities: [
      'Set the ideal customer profile and a 90-day pipeline goal with the founder.',
      'Run discovery, demos, proposals and paid pilots through to close.',
      'Work with marketing and partnerships on lead flow.',
      'Keep the CRM accurate and report pipeline weekly.',
    ],
    required: [
      '8+ years of experience in B2B sales, with a record of closing deals with HR, talent, education or workforce buyers.',
      'Experience selling a product that is still proving itself.',
      'Honest, clear forecasting.',
      'Everyday use of AI tools for prospect research and drafting outreach, with your own edit before anything is sent.',
    ],
    preferred: [
      'Experience selling outplacement, HR technology, higher-education technology or workforce services.',
      'Experience hiring and managing sales reps.',
    ],
    skills: ['enterprise sales', 'pipeline management', 'quota', 'salesforce', 'crm management', 'contract negotiation', 'go-to-market'],
    knowledge: ['Pilot-based enterprise selling', 'How workforce boards, colleges and HR teams buy', 'Public-sector and procurement cycles'],
    howYouWork: [
      'You are direct about what will and will not close.',
      'You keep your pipeline and notes current without being asked.',
      'You follow up persistently and stay respectful.',
    ],
    firstNinetyDays: ['A ranked target list.', 'First demos booked.', 'A first paid pilot proposal sent.'],
  },
  {
    slug: 'sales-development-representative',
    title: 'Sales development representative',
    matchTitle: 'Sales Development Representative',
    kind: 'contributor',
    group: 'sales',
    employment: 'Full-time',
    summary: 'Research prospects, send outreach and book meetings for the B2B sales lead. No experience needed.',
    about:
      'The sales development representative finds the right people at workforce boards, colleges, outplacement firms and employers and starts the conversation. You work for the B2B sales lead. AI tools draft; you edit and send.',
    seniority: 'Early-career individual contributor. Reports to the B2B sales lead. Comparable titles: Business Development Representative.',
    function: 'Sales',
    rung: 'ENTRY_IC',
    yearsMin: null,
    focus: BUYERS,
    responsibilities: [
      'Work the ranked lead list and personalize outreach.',
      'Follow up on every reply and keep the CRM current.',
      'Book qualified meetings and hand them off with clear notes.',
    ],
    required: [
      'No experience needed. We teach the job.',
      'Excellent written communication.',
      'A habit of tracking your own results.',
      'Comfort using AI tools to draft and research, and the habit of editing what they produce before it is sent.',
    ],
    preferred: ['Experience in sales development, recruiting or customer-facing work.', 'Experience with outbound email and a CRM.'],
    skills: ['crm', 'hubspot', 'pipeline management', 'demand generation'],
    knowledge: ['Outbound email and follow-up cadence', 'Researching an organization and its decision makers'],
    howYouWork: [
      'You are curious about the buyer before you write.',
      'You are persistent without pestering.',
      'You ask for feedback and change your approach.',
    ],
    firstNinetyDays: ['A steady weekly volume of outreach, with a measured reply rate and meetings booked.'],
  },
  {
    slug: 'partnerships-lead',
    title: 'Partnerships lead',
    matchTitle: 'Director of Partnerships',
    kind: 'lead',
    group: 'partnerships',
    employment: 'Full-time',
    summary: 'Build relationships with workforce boards, colleges, outplacement providers, employers, and research and academic partners.',
    about:
      'Partners bring NextChapter its users and its credibility: workforce boards, colleges, outplacement firms, employers, coaches, recruiters, and research and academic groups tied to the monthly report. The partnerships lead chooses them, builds the relationships and runs the pilots.',
    seniority: 'Senior leader. Owns partnerships and reports to the founder. Works alongside the sales lead. Comparable titles: Director of Partnerships, Head of Partnerships.',
    function: 'Sales',
    rung: 'DIRECTOR',
    yearsMin: 8,
    focus: ['Workforce boards', 'Higher education institutions', 'Outplacement firms and employers', 'Research and academic partners'],
    responsibilities: [
      'Choose priority partners and run pilots with them.',
      'Bring coaches and recruiters onto the platform.',
      'Develop research partnerships tied to the monthly report.',
      'Work with the sales lead so partners and buyers are not approached twice.',
    ],
    required: [
      '8+ years of experience building partnerships or alliances.',
      'Credibility with public, education or professional-services institutions.',
      'Experience negotiating partnership terms.',
      'Everyday use of AI tools to research partners and prepare materials.',
    ],
    preferred: ['Experience with workforce boards, community colleges or universities.', 'Experience with research or academic collaborations.'],
    skills: ['channel partnerships', 'contract negotiation', 'stakeholder management', 'go-to-market', 'strategic planning'],
    knowledge: ['Workforce development funding and the public workforce system', 'How colleges and universities partner', 'Co-authoring and citing research'],
    howYouWork: [
      'You are patient with long cycles and stay in touch without pushing.',
      'You make introductions that help both sides.',
      'You are honest about what we can and cannot deliver.',
    ],
    firstNinetyDays: ['A priority partner list.', 'A first pilot conversation with a workforce board or college.', 'The first group of coaches and recruiters onboarded.'],
  },
  {
    slug: 'product-lead',
    title: 'Product lead',
    matchTitle: 'Director of Product',
    kind: 'lead',
    group: 'product',
    employment: 'Full-time',
    summary: 'Decide what we build next across the candidate platform and the employer, college, coach and recruiter products.',
    about:
      'NextChapter has a candidate product and products for employers, colleges, coaches and recruiters. The product lead decides what gets built, in what order, and whether it worked, using customer feedback and usage data.',
    seniority: 'Senior leader. Owns product and reports to the founder. Sets priorities for engineering with the technology lead. Comparable titles: Director of Product, Head of Product.',
    function: 'Product',
    rung: 'DIRECTOR',
    yearsMin: 8,
    focus: ['Candidate product', 'B2B products'],
    responsibilities: [
      'Own the roadmap and a short, ranked priority list.',
      'Turn customer feedback and usage data into decisions.',
      'Work with the founder and engineering on priorities, privacy and trust.',
      'Define success measures and review them monthly.',
    ],
    required: [
      '8+ years of experience in product management, including software products you shipped and the outcomes they produced.',
      'Strong user research and data habits.',
      'Judgment about privacy in a sensitive area.',
      'Hands-on use of AI tools in product work: research, specs and analysis.',
    ],
    preferred: ['Experience with both consumer and B2B products.', 'You have built AI-assisted products.'],
    skills: ['roadmapping', 'a/b testing', 'agile', 'figma', 'sql', 'google analytics', 'cross-functional leadership'],
    knowledge: ['Customer interviews and usage analysis', 'Pricing and packaging', 'Privacy and trust in a job-search product'],
    howYouWork: [
      'You decide with incomplete information and revisit when evidence changes.',
      'You say no to good ideas that are not the next one.',
      'You work closely with engineers, and write specs they can build from.',
    ],
    firstNinetyDays: ['A written roadmap.', 'A prioritized fix list drawn from user feedback.', 'Billing and checkout scoped with engineering.'],
  },
  {
    slug: 'technology-lead',
    title: 'Technology lead',
    matchTitle: 'Director of Engineering',
    kind: 'lead',
    group: 'technology',
    employment: 'Full-time',
    summary: 'Lead engineering and own how AI is used across the product and the company. Hands-on AI experience is required.',
    about:
      'NextChapter runs on TypeScript, React and Postgres, with AI features throughout the product and AI agents that help run the business. The technology lead owns the technical direction, security and reliability, and the standards for how AI is built, evaluated and paid for.',
    seniority: 'Senior leader and hands-on engineer. Owns engineering and reports to the founder. Builds and mentors the team as it grows. Comparable titles: Director of Engineering, Head of Engineering.',
    function: 'Engineering',
    rung: 'DIRECTOR',
    yearsMin: 10,
    responsibilities: [
      'Own the technical direction of the platform, and keep it secure and reliable.',
      'Design, build and evaluate the AI features and AI agents that help run the product and the business.',
      'Set the standards for safety, privacy, cost and quality in every AI use.',
      'Build and mentor the engineering team as it grows.',
      'Work with the product lead to ship what matters.',
    ],
    required: [
      '10+ years of software engineering experience, including leading engineers or readiness to.',
      'Hands-on experience building and shipping AI-powered software to production (required).',
      'Strong full-stack engineering.',
    ],
    preferred: ['Experience with Next.js, Prisma and Postgres.', 'Experience evaluating and monitoring LLM output.'],
    skills: ['typescript', 'react', 'node.js', 'sql', 'postgresql', 'aws', 'ci/cd', 'rest api', 'machine learning', 'docker', 'agile', 'team building'],
    knowledge: [
      'Building with large language models: prompting, evaluation, cost control',
      'Protecting sensitive personal data',
      'Authentication, security reviews and incident response',
    ],
    howYouWork: [
      'You write code and review it, and you ship small and often.',
      'You measure AI output rather than trusting it.',
      'You explain technical tradeoffs plainly to people who are not engineers.',
    ],
    firstNinetyDays: ['A review of the codebase, security and AI costs.', 'Billing and checkout delivered or scheduled.', 'A written standard for how AI is used and approved.'],
  },
  {
    slug: 'marketing-lead',
    title: 'Marketing lead',
    matchTitle: 'Director of Marketing',
    kind: 'lead',
    group: 'marketing',
    employment: 'Full-time',
    summary: 'Own how NextChapter reaches employers, partners and candidates: LinkedIn, B2B campaigns, and the monthly newsletter outreach.',
    about:
      'The marketing lead takes NextChapter to the people who should know about it: employers, colleges, workforce boards, partners and candidates. You work with the editorial lead, who owns what we say, and the sales lead, who owns the pipeline.',
    seniority: 'Senior leader. Owns marketing channels and reports to the founder. Comparable titles: Director of Marketing, Head of Marketing.',
    function: 'Marketing',
    rung: 'DIRECTOR',
    yearsMin: 7,
    responsibilities: [
      'Run the LinkedIn calendar for the company and the founder.',
      'Plan and run B2B campaigns to the lead list, with the sales lead.',
      'Own newsletter operations: lists, segments, schedule, sends and unsubscribes.',
      'Take each monthly report to press, partners and the people who should read it.',
      'Report weekly on what worked, from visit to signup to meeting.',
    ],
    required: [
      '7+ years of experience in marketing, including B2B campaigns you ran and their results.',
      'Comfort with analytics and testing.',
      'Care about accuracy in everything you publish.',
      'Everyday use of AI tools for drafting, research and campaign analysis, and knowing where they fail.',
    ],
    preferred: ['Experience with LinkedIn and email marketing at a small company.', 'You use AI tools to draft and research, and you know where they fail.'],
    skills: ['seo', 'google analytics', 'hubspot', 'demand generation', 'account-based marketing', 'content strategy', 'crm'],
    knowledge: ['Email deliverability and list hygiene', 'Marketing to HR, education and workforce buyers', 'Attribution from first visit to meeting booked'],
    howYouWork: [
      'You test, measure and change course quickly.',
      'You work with the editorial lead on voice and the sales lead on targets.',
      'You stay inside the law on email and claims.',
    ],
    firstNinetyDays: ['A steady posting cadence.', 'Three tested B2B sequences.', 'The newsletter sent on time each month, with a first attribution report.'],
  },
  {
    slug: 'internship',
    title: 'Intern',
    matchTitle: 'Intern',
    kind: 'contributor',
    group: 'early-career',
    employment: 'Internship',
    summary: 'Work on a real project with one of our leads and learn how a small company runs. No experience needed.',
    about:
      'An intern joins one team (editorial, marketing, sales, partnerships, product or technology) and works on a defined project with that team’s lead, then presents what they learned and made.',
    seniority: 'Entry level. Reports to the lead of the team you join. No prior experience is required.',
    function: null,
    rung: 'OTHER',
    yearsMin: null,
    responsibilities: [
      'Work on a defined project with one team.',
      'Present what you learned and made at the end.',
    ],
    required: ['No experience needed.', 'Currently studying, or recently finished studying.', 'Clear writing.', 'Evidence you finish what you start.', 'Comfort using AI tools every day. We will show you how we use them.'],
    preferred: [],
    skills: ['excel', 'project management'],
    knowledge: ['Willingness to learn a new field quickly'],
    howYouWork: ['You ask questions early.', 'You take feedback well.', 'You tell your lead when you are stuck.'],
  },
  {
    slug: 'associate-program',
    title: 'Associate, new graduate program',
    matchTitle: 'Associate, new graduate program',
    kind: 'contributor',
    group: 'early-career',
    employment: 'Associate program',
    summary: 'A first full-time job for new college graduates, working alongside a lead on one team. No experience needed.',
    about:
      'The associate program is a first full-time job for new college graduates. You join one team and work alongside its lead on real work, with regular time with the founder, and take on more ownership as you show what you can do.',
    seniority: 'Entry-level individual contributor. Reports to the lead of the team you join.',
    function: null,
    rung: 'ENTRY_IC',
    yearsMin: null,
    responsibilities: [
      'Work alongside the lead of one team on real work.',
      'Learn the whole business, with regular time with the founder.',
      'Take on more ownership as you show what you can do.',
    ],
    required: ['No experience needed.', 'A recent college degree, or finishing one soon.', 'Evidence of what you can do: projects, work, writing or leadership.', 'Clear writing.', 'Comfort using AI tools every day. We will show you how we use them.'],
    preferred: [],
    skills: ['excel', 'project management', 'crm'],
    knowledge: ['Willingness to learn a new field quickly'],
    howYouWork: ['You take ownership of small things and finish them.', 'You ask for feedback often.', 'You share what you are learning.'],
  },
  {
    slug: 'coach',
    title: 'Coach on NextChapter',
    matchTitle: 'Career Coach',
    kind: 'platform',
    group: 'platform',
    employment: 'Platform',
    summary: 'Join the coach platform and work with clients who come through NextChapter. This is not a job.',
    about:
      'Coaches work with clients who come through NextChapter. You get pre-session briefs and note summaries, book sessions through the platform and set your own hours.',
    seniority: 'Independent coach. Not an employee.',
    function: null,
    rung: 'OTHER',
    yearsMin: null,
    responsibilities: [
      'Receive pre-session briefs and note summaries, and book sessions through the platform.',
      'Set your own hours. Clients are introduced to you through the platform.',
    ],
    required: ['Experience coaching mid-career or executive clients.', 'Training or credentials you can describe.', 'References.'],
    preferred: [],
    skills: [],
    knowledge: [],
    howYouWork: [],
    externalHref: '/coaches',
  },
  {
    slug: 'recruiter',
    title: 'Recruiter on NextChapter',
    matchTitle: 'Recruiter',
    kind: 'platform',
    group: 'platform',
    employment: 'Platform',
    summary: 'Join the recruiter portal and meet candidates who choose to be visible to recruiters. This is not a job.',
    about:
      'Recruiters use the NextChapter portal to search candidates who chose to be visible, post roles to the job board and calibrate searches with candidates.',
    seniority: 'Independent recruiter or search firm. Not an employee.',
    function: null,
    rung: 'OTHER',
    yearsMin: null,
    responsibilities: ['Search for candidates, post roles to the job board and calibrate searches with candidates.'],
    required: ['An active search practice.', 'A record of ethical, candidate-first work.', 'References.'],
    preferred: [],
    skills: [],
    knowledge: [],
    howYouWork: [],
    externalHref: '/recruiters',
  },
]

export function getRole(slug: string): CareerRole | undefined {
  return CAREER_ROLES.find((r) => r.slug === slug)
}

export function rolesInGroup(group: RoleGroup): CareerRole[] {
  return CAREER_ROLES.filter((r) => r.group === group)
}
