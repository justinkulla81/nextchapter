// Pure rules for the role pages (/roles/<role>): one page per leadership role (the C-suite, VP and Director of each function),
// which job titles count toward a role, the names and spellings a role goes by, and the bars a page must clear. No I/O, so it
// is unit-tested (src/test/role-pages.test.ts). The scan that feeds it is in role-figures.ts; its figures are stored by the
// board-figures cron, so no page runs a scan itself.
//
// A role is a family of titles, not one title: "CRO", "Chief Revenue Officer", "Chief Sales Officer" and "Head of Sales" are one
// role, so the page has enough listings to say something real about pay, industries, states and skills. Every title matches
// through its spoken forms (acronym, spelled out, "Vice President, Sales", "Sales VP", "SVP of Sales").

export type RoleLevel = 'c-suite' | 'vp' | 'director'

export interface RoleDef {
  /** The canonical address: the spelled-out words for the C-suite ("chief-revenue-officer"), "vp-of-sales", "director-of-sales". */
  slug: string
  level: RoleLevel
  /** What the page calls the role, in the form people search it: "Chief Revenue Officer (CRO)", "VP of Sales", "Director of Sales". */
  name: string
  /** The short form for running text: "CRO", "VP of Sales", "Director of Sales". */
  short: string
  /** The spelled-out form: "Chief Revenue Officer", "Vice President of Sales", "Director of Sales". */
  spelled: string
  acronym: string | null
  /** The function the role sits in (a job-functions.ts label), for the function-wide skills and the AI-skill pay premium. */
  fn: string
  /** The function family the role belongs to; roles that share it at different levels are each other's ladder. */
  ladder: string
  /** The other ways the role is written; shown on the page and in its description. */
  variants: string[]
  /** Other addresses that go to this page (acronyms, other word orders). Never listed in the sitemap. */
  aliases: string[]
  /** One or two plain sentences on what the role owns. */
  owns: string
  /** Where it usually sits. Hedged on the page ("usually"). */
  sits: string
  /** Matched against a normalized title (see normalizeTitle): any hit counts. */
  names: RegExp[]
  /** Word-bounded acronyms, matched the same way but dropped when `acronymGuard` also matches (CMO in a hospital is not marketing). */
  acronyms: RegExp[]
  acronymGuard?: RegExp
  /** A title that matches this is never the role. */
  exclude?: RegExp
}

/** Open listings a role needs before it gets a page. A role below the bar redirects to a job search and joins the sitemap on its own once the listings arrive. */
export const ROLE_MIN_JOBS = 15
/** Listings with a usable stated annual pay before the page shows a pay figure. */
export const ROLE_MIN_PAY = 8
/** Cells below these counts are left off the page: a share of five listings is not a market. */
export const ROLE_MIN_STATE_JOBS = 3
export const ROLE_MIN_INDUSTRY_JOBS = 5
export const ROLE_MIN_SKILL_SAMPLE = 25
export const ROLE_MIN_AI_SAMPLE = 30
/** Newest listing ids stored per role (the page shows 15 after re-checking each against the full public-page rule). */
export const ROLE_JOB_IDS = 40

/** Lower-case, "&" read as "and", every other mark a space: "VP, Sales & Marketing (US)" -> "vp sales and marketing us". */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── what never counts ──
// Staff around the leader, not the leader. Applied to every role.
const NOT_THE_LEADER = /\b(assistant|associate|coordinator|intern|analyst|specialist|manager|engineer|representative|administrator|paralegal|chief of staff|to the|avp|consultant|consulting|advisory|advisor|technician|technologist|account executive|assoc|sales executive|product owner)\b/

const w = (s: string) => new RegExp(`\\b(?:${s})\\b`)

// ── C-suite ──
interface Chief {
  slug: string
  name: string
  short: string
  spelled: string
  acronym: string | null
  fn: string
  ladder: string
  variants: string[]
  aliases: string[]
  owns: string
  sits: string
  names: string
  acronyms?: string
  acronymGuard?: RegExp
  exclude?: RegExp
}

const CHIEFS: Chief[] = [
  {
    slug: 'chief-executive-officer', name: 'Chief Executive Officer (CEO)', short: 'CEO', spelled: 'Chief Executive Officer', acronym: 'CEO', fn: 'Executive Leadership', ladder: 'executive',
    variants: ['CEO', 'Chief Executive Officer', 'President and CEO', 'Founder and CEO'], aliases: ['ceo', 'president-and-ceo'],
    owns: 'The whole company: strategy, the executive team, capital, and the results the board holds the company to.',
    sits: 'Reports to the board of directors.',
    names: 'chief executive officer|president and ceo|founder and ceo', acronyms: 'ceo',
  },
  {
    slug: 'chief-operating-officer', name: 'Chief Operating Officer (COO)', short: 'COO', spelled: 'Chief Operating Officer', acronym: 'COO', fn: 'Operations', ladder: 'operations',
    variants: ['COO', 'Chief Operating Officer', 'Chief Operations Officer', 'Head of Operations'], aliases: ['coo', 'chief-operations-officer', 'head-of-operations'],
    owns: 'How the company runs day to day: operations, delivery, process and the cross-functional plan that turns strategy into output.',
    sits: 'Usually reports to the CEO.',
    names: 'chief operating officer|chief operations officer|head of operations', acronyms: 'coo', acronymGuard: /\b(?:cooperative|coo coo)\b/,
  },
  {
    slug: 'chief-financial-officer', name: 'Chief Financial Officer (CFO)', short: 'CFO', spelled: 'Chief Financial Officer', acronym: 'CFO', fn: 'Finance', ladder: 'finance',
    variants: ['CFO', 'Chief Financial Officer', 'Head of Finance'], aliases: ['cfo', 'head-of-finance'],
    owns: 'Finance, accounting, planning, capital and the numbers the board and investors see.',
    sits: 'Usually reports to the CEO.',
    names: 'chief financial officer|head of finance', acronyms: 'cfo',
  },
  {
    slug: 'chief-revenue-officer', name: 'Chief Revenue Officer (CRO)', short: 'CRO', spelled: 'Chief Revenue Officer', acronym: 'CRO', fn: 'Sales', ladder: 'sales',
    variants: ['CRO', 'Chief Revenue Officer', 'Chief Sales Officer', 'Chief Commercial Officer', 'Head of Sales', 'Head of Revenue'],
    aliases: ['cro', 'head-of-sales', 'head-of-revenue', 'chief-sales-officer', 'chief-commercial-officer', 'head-of-sales-and-revenue'],
    owns: 'The revenue number: sales, and often marketing, customer success and partnerships behind it. Owns the forecast and the plan to hit it.',
    sits: 'Usually reports to the CEO. At smaller companies the same job is titled Head of Sales.',
    names: 'chief revenue officer|chief sales officer|chief commercial officer|head of sales(?! enablement| operations| ops| training| engineering| support| development)|head of revenue(?! operations| cycle)|head of commercial(?! operations)', acronyms: 'cro',
    acronymGuard: /\b(?:clinical|contract research|research organization|oversight|vendor|cmc|trial|monitor\w*|production|laboratory|lab|pharma\w*|biotech|assay|study|studies|risk|chief risk)\b/,
  },
  {
    slug: 'chief-marketing-officer', name: 'Chief Marketing Officer (CMO)', short: 'CMO', spelled: 'Chief Marketing Officer', acronym: 'CMO', fn: 'Marketing', ladder: 'marketing',
    variants: ['CMO', 'Chief Marketing Officer', 'Head of Marketing', 'Chief Brand Officer', 'Chief Growth Officer'],
    aliases: ['cmo', 'head-of-marketing', 'chief-brand-officer', 'chief-growth-officer'],
    owns: 'Brand, demand generation, product marketing and the marketing budget, and increasingly the data and tools behind them.',
    sits: 'Usually reports to the CEO.',
    names: 'chief marketing officer|chief brand officer|chief growth officer|head of marketing|head of growth marketing', acronyms: 'cmo',
    acronymGuard: /\b(?:medical|medicine|physician|clinical|hospital|nurs\w*|surgeon|surgical|health system|patient)\b/,
  },
  {
    slug: 'chief-product-officer', name: 'Chief Product Officer (CPO)', short: 'CPO', spelled: 'Chief Product Officer', acronym: 'CPO', fn: 'Product', ladder: 'product',
    variants: ['CPO', 'Chief Product Officer', 'Head of Product', 'Chief Product and Technology Officer'], aliases: ['cpo', 'head-of-product'],
    owns: 'What the company builds and why: product strategy, the roadmap, and the product and design teams.',
    sits: 'Usually reports to the CEO.',
    names: 'chief product officer|chief product and technology officer|head of product(?! marketing| support| safety| quality| compliance| security| line| owner| specialist)', acronyms: 'cpo',
    acronymGuard: /\b(?:people|procurement|purchasing|privacy|pool|plant|program|property|personnel|patient|payments?|protection|officer flex|flex officer)\b/,
  },
  {
    slug: 'chief-technology-officer', name: 'Chief Technology Officer (CTO)', short: 'CTO', spelled: 'Chief Technology Officer', acronym: 'CTO', fn: 'Engineering', ladder: 'engineering',
    variants: ['CTO', 'Chief Technology Officer', 'Chief Technical Officer', 'Head of Engineering', 'Head of Technology'],
    aliases: ['cto', 'chief-technical-officer', 'head-of-engineering', 'head-of-technology'],
    owns: 'The technology the company sells or runs on: engineering, architecture, and how fast and safely it ships.',
    sits: 'Usually reports to the CEO.',
    names: 'chief technology officer|chief technical officer|head of engineering|head of technology|head of software engineering', acronyms: 'cto', acronymGuard: /\b(?:talent|people|human|tax|certified|dental)\b/,
  },
  {
    slug: 'chief-information-officer', name: 'Chief Information Officer (CIO)', short: 'CIO', spelled: 'Chief Information Officer', acronym: 'CIO', fn: 'Operations', ladder: 'it',
    variants: ['CIO', 'Chief Information Officer', 'Head of IT', 'Head of Information Technology'], aliases: ['cio', 'head-of-it', 'head-of-information-technology'],
    owns: 'Internal technology: systems, infrastructure, vendors, data platforms and the IT budget that keeps the business running.',
    sits: 'Usually reports to the CEO or CFO.',
    names: 'chief information officer|head of it|head of information technology', acronyms: 'cio',
    exclude: /\bchief information (?:security|risk) officer\b/,
  },
  {
    slug: 'chief-information-security-officer', name: 'Chief Information Security Officer (CISO)', short: 'CISO', spelled: 'Chief Information Security Officer', acronym: 'CISO', fn: 'Security', ladder: 'security',
    variants: ['CISO', 'Chief Information Security Officer', 'Chief Security Officer', 'Head of Information Security', 'Head of Cybersecurity'],
    aliases: ['ciso', 'chief-security-officer', 'head-of-security', 'head-of-information-security', 'head-of-cybersecurity'],
    owns: 'Protecting the company’s data and systems: security strategy, risk, incident response and the board’s view of cyber risk.',
    sits: 'Reports to the CIO, CTO, CEO or general counsel, depending on the company.',
    names: 'chief information security officer|chief cyber ?security officer|chief security officer|head of information security|head of cyber ?security|head of security', acronyms: 'ciso',
    exclude: /\b(?:physical|campus|loss prevention|facilit\w*|guard|law enforcement|patrol)\b/,
  },
  {
    slug: 'chief-human-resources-officer', name: 'Chief Human Resources Officer (CHRO)', short: 'CHRO', spelled: 'Chief Human Resources Officer', acronym: 'CHRO', fn: 'Human Resources', ladder: 'people',
    variants: ['CHRO', 'Chief Human Resources Officer', 'Chief People Officer', 'Chief Talent Officer', 'Chief Human Capital Officer', 'Head of HR', 'Head of People'],
    aliases: ['chro', 'chief-people-officer', 'chief-talent-officer', 'chief-human-capital-officer', 'head-of-hr', 'head-of-people', 'head-of-human-resources'],
    owns: 'Hiring, pay, benefits, culture, development and the organization design behind them.',
    sits: 'Usually reports to the CEO.',
    names: 'chief human resources officer|chief people officer|chief talent officer|chief human capital officer|head of hr|head of human resources|head of people(?! analytics)', acronyms: 'chro',
  },
  {
    slug: 'general-counsel', name: 'General Counsel (Chief Legal Officer, CLO)', short: 'General Counsel', spelled: 'General Counsel', acronym: 'CLO', fn: 'Legal', ladder: 'legal',
    variants: ['General Counsel', 'GC', 'Chief Legal Officer', 'CLO', 'Chief Counsel', 'Head of Legal'], aliases: ['gc', 'clo', 'chief-legal-officer', 'chief-counsel', 'head-of-legal'],
    owns: 'The company’s legal work: contracts, litigation, regulatory exposure, corporate governance and advice to the board.',
    sits: 'Usually reports to the CEO.',
    names: 'general counsel|chief legal officer|chief counsel|head of legal', acronyms: 'clo', acronymGuard: /\b(?:learning|logistics|talent|training|l and d)\b/,
    exclude: /\b(?:deputy|assistant|associate|senior counsel|litigation counsel|employment counsel|staff attorney|attorney)\b/,
  },
  {
    slug: 'chief-data-officer', name: 'Chief Data Officer (CDO)', short: 'CDO', spelled: 'Chief Data Officer', acronym: 'CDO', fn: 'Data & Analytics', ladder: 'data',
    variants: ['CDO', 'Chief Data Officer', 'Chief Analytics Officer', 'Chief Data and Analytics Officer', 'Head of Data'], aliases: ['cdo', 'chief-analytics-officer', 'head-of-data'],
    owns: 'The company’s data: where it lives, who can use it, its quality, and the analytics and AI work built on it.',
    sits: 'Usually reports to the CEO, CIO or CTO.',
    names: 'chief data officer|chief analytics officer|chief data and analytics officer|chief data and ai officer|head of data(?! center| entry)|head of analytics|head of data science', acronyms: 'cdo',
    acronymGuard: /\b(?:design|dental|digital|diversity|debt|obligation|development|doctor)\b/,
  },
  {
    slug: 'chief-ai-officer', name: 'Chief AI Officer (CAIO)', short: 'Chief AI Officer', spelled: 'Chief Artificial Intelligence Officer', acronym: 'CAIO', fn: 'Data & Analytics', ladder: 'data',
    variants: ['CAIO', 'Chief AI Officer', 'Chief Artificial Intelligence Officer', 'Head of AI', 'Head of Artificial Intelligence'], aliases: ['caio', 'chief-artificial-intelligence-officer', 'head-of-ai'],
    owns: 'Where and how the company uses AI: the strategy, the build-or-buy choices, the governance, and getting the work into products and daily operations.',
    sits: 'Usually reports to the CEO, CTO or CDO.',
    names: 'chief ai officer|chief artificial intelligence officer|chief ai and data officer|head of ai(?! driven| powered| native| enabled| first| based| assisted)|head of artificial intelligence', acronyms: 'caio',
  },
  {
    slug: 'chief-customer-officer', name: 'Chief Customer Officer (CCO)', short: 'Chief Customer Officer', spelled: 'Chief Customer Officer', acronym: 'CCO', fn: 'Customer Success', ladder: 'customer',
    variants: ['CCO', 'Chief Customer Officer', 'Chief Client Officer', 'Chief Customer Success Officer', 'Chief Experience Officer', 'Head of Customer Success'],
    aliases: ['cco', 'chief-client-officer', 'chief-customer-success-officer', 'chief-experience-officer', 'head-of-customer-success', 'head-of-customer-experience'],
    owns: 'Everything after the sale: onboarding, support, retention and expansion, and the customer’s view of the company.',
    sits: 'Usually reports to the CEO or CRO. “CCO” can also mean Chief Commercial or Chief Compliance Officer; commercial roles are on the CRO page.',
    names: 'chief customer officer|chief client officer|chief customer success officer|chief experience officer|chief customer experience officer|head of customer success|head of customer experience|head of customer support', acronyms: 'cco',
    acronymGuard: /\b(?:compliance|commercial|credit|content|creative|clinical|communications|cannabis)\b/,
  },
  {
    slug: 'chief-strategy-officer', name: 'Chief Strategy Officer (CSO)', short: 'Chief Strategy Officer', spelled: 'Chief Strategy Officer', acronym: 'CSO', fn: 'Strategy', ladder: 'strategy',
    variants: ['CSO', 'Chief Strategy Officer', 'Chief Strategy and Operations Officer', 'Head of Strategy'], aliases: ['cso', 'head-of-strategy', 'chief-strategy-and-operations-officer'],
    owns: 'Where the company competes and how: corporate strategy, planning, acquisitions and partnerships.',
    sits: 'Usually reports to the CEO. “CSO” can also mean Chief Security Officer; security roles are on the CISO page.',
    names: 'chief strategy officer|chief strategy and operations officer|chief strategy and corporate development officer|head of strategy',
  },
  {
    slug: 'executive-director', name: 'Executive Director (ED)', short: 'Executive Director', spelled: 'Executive Director', acronym: 'ED', fn: 'Executive Leadership', ladder: 'executive',
    variants: ['Executive Director', 'ED', 'Executive Director and CEO', 'President and Executive Director'], aliases: ['ed', 'executive-director-nonprofit'],
    owns: 'A non-profit, association or agency: its mission, budget, staff, fundraising and the board it answers to. At some banks and firms “Executive Director” is a senior rank instead.',
    sits: 'Reports to the board of directors.',
    names: 'executive director',
    // "Executive Director, Client Services" is a rank inside a company, not the head of an organization.
    exclude: /\b(?:deputy|managing|assistant|associate|vice)\b|\bexecutive director (?:of |for )?(?:\w+ ){0,2}(?:sales|marketing|operations|finance|financial|client|customer|technology|engineering|product|data|analytics|human resources|people|talent|strategy|risk|compliance|clinical|medical|nursing|quality|supply chain|research|development|programs?|services|communications|it|hr)\b/,
  },
]

// ── functions that get a VP page and a Director page ──
interface Fn {
  key: string
  /** The job-functions.ts label. */
  fn: string
  /** The word in the slug and the name: "vp-of-sales". */
  noun: string
  /** Other spellings of the function a title uses, shown as variants. */
  alt: string[]
  /** What a title says when it is in this function (normalized, matched as whole words, longest first). */
  words: string
  /** Words that make a hit something else ("sales operations" is not operations). */
  notAfter?: string
  /** The same, for what comes just before the word ("sales engineering" is not engineering). */
  notBefore?: string
  /** Short words ("it", "ai", "hr") that count only right next to the level word, so "Director of Sales, AI tools" is not an AI role. */
  tight?: string
  owns: string
}

const FUNCTIONS: Fn[] = [
  {
    key: 'sales', fn: 'Sales', noun: 'Sales', alt: ['Revenue', 'Business Development'],
    words: 'sales|revenue|business development|commercial|channel|inside sales|field sales|enterprise sales',
    notAfter: '(?! cycle| integrity| accounting| recognition| assurance| audit| compliance| reporting| management systems)',
    owns: 'the sales team, the quota and the forecast',
  },
  {
    key: 'marketing', fn: 'Marketing', noun: 'Marketing', alt: ['Growth', 'Demand Generation', 'Brand'],
    words: 'marketing|growth marketing|demand generation|demand gen|brand|product marketing|digital marketing|brand marketing',
    owns: 'brand, demand generation and the marketing budget',
  },
  {
    key: 'engineering', fn: 'Engineering', noun: 'Engineering', alt: ['Software Engineering', 'Platform Engineering'],
    words: 'engineering|software engineering|software development|platform engineering|infrastructure engineering|site reliability|devops',
    notBefore: '(?<!sales |solutions |field |application |customer |pre sales )',
    owns: 'the engineering teams, the architecture and how reliably the product ships',
  },
  {
    key: 'product', fn: 'Product', noun: 'Product', alt: ['Product Management'],
    words: 'product|product management',
    notAfter: '(?! marketing| support| safety| quality| compliance| security| supply| sales| specialist)',
    owns: 'the product roadmap, the product managers and the decisions about what gets built',
  },
  {
    key: 'finance', fn: 'Finance', noun: 'Finance', alt: ['Financial Planning', 'Accounting'],
    words: 'finance|financial planning|financial reporting|financial controller|fp and a|accounting|treasury',
    owns: 'finance, accounting and planning, and the reporting leaders rely on',
  },
  {
    key: 'operations', fn: 'Operations', noun: 'Operations', alt: ['Business Operations', 'Supply Chain'],
    words: 'operations|business operations|supply chain|logistics',
    notAfter: '(?! research)',
    owns: 'how the work gets done: process, delivery, cost and the teams that run it',
  },
  {
    key: 'people', fn: 'Human Resources', noun: 'Human Resources', alt: ['People', 'HR', 'Talent'],
    words: 'human resources|people|talent|talent acquisition|total rewards|people operations|employee experience',
    tight: 'hr',
    notAfter: '(?! analytics)',
    owns: 'hiring, pay, benefits, employee relations and development',
  },
  {
    key: 'customer', fn: 'Customer Success', noun: 'Customer Success', alt: ['Customer Experience', 'Customer Support', 'Client Services'],
    words: 'customer success|customer experience|customer support|customer service|customer operations|client success|client services|customer support operations|technical support|client support',
    owns: 'onboarding, support, retention and expansion for existing customers',
  },
  {
    key: 'it', fn: 'Operations', noun: 'IT', alt: ['Information Technology', 'Information Systems'],
    words: 'information technology|information systems|it infrastructure|technology infrastructure|cloud infrastructure|enterprise applications',
    tight: 'it',
    notAfter: '(?! security)',
    owns: 'internal systems, infrastructure, vendors and the IT budget',
  },
  {
    key: 'data', fn: 'Data & Analytics', noun: 'Data', alt: ['Analytics', 'Data Science', 'AI'],
    words: 'data|analytics|data science|business intelligence|machine learning|artificial intelligence|data engineering',
    tight: 'ai',
    notAfter: '(?! center| entry| processing)',
    owns: 'data platforms, analytics, data science and AI work',
  },
  {
    key: 'security', fn: 'Security', noun: 'Information Security', alt: ['Cybersecurity', 'Security'],
    words: 'information security|cyber ?security|cyber|it security|infosec|application security|product security|cloud security|security engineering|security operations|security architecture|grc',
    owns: 'protecting the company’s data and systems: risk, controls and incident response',
  },
]

const ESCAPE_FN = (words: string, notAfter = '') => `(?:${words})${notAfter}`
const FN_NOT_AFTER_SPECIAL: Record<string, string> = {
  // "sales operations" and "revenue operations" are sales; "security operations" is security; neither is the Operations function.
  operations: '(?<!sales |revenue |marketing |people |security |hr |it |clinical |network |field |trade )',
}

const VP_WORD = '(?:vp|svp|evp|vice president)'
const NOT_VP = /\b(?:avp|assistant vice president|associate vice president|assistant vp|associate vp|vice president of admissions|vice president and (?:general|associate) counsel)\b/
const NOT_DIRECTOR = /\b(?:account director|client director|associate director|assistant director|managing director|executive director|art director|creative director|casting director|funeral director|music director|medical director|clinical director|program director|deputy director)\b/

function fnSource(f: Fn): string {
  return `${FN_NOT_AFTER_SPECIAL[f.key] ?? ''}${f.notBefore ?? ''}${ESCAPE_FN(f.words, f.notAfter)}`
}

/** The patterns for "<level word> ... <function>" and "<function> ... <level word>": full words within a few words, short words right beside. */
function levelPatterns(f: Fn, level: string): RegExp[] {
  const src = fnSource(f)
  const out = [new RegExp(`\\b${level}\\b(?: \\S+){0,3}? ${src}\\b`), new RegExp(`\\b${src}\\b(?: \\S+){0,2}? ${level}\\b`)]
  if (f.tight) out.push(new RegExp(`\\b${level}\\b(?: (?:of|for|and))? (?:${f.tight})\\b`), new RegExp(`\\b(?:${f.tight}) ${level}\\b`))
  return out
}

function vpRole(f: Fn): RoleDef {
  const noun = f.noun
  const slugNoun = noun.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const variants = [
    `VP of ${noun}`, `VP ${noun}`, `Vice President of ${noun}`, `Vice President, ${noun}`, `SVP ${noun}`, `Senior Vice President of ${noun}`, `EVP ${noun}`,
    `Executive Vice President of ${noun}`, ...f.alt.slice(0, 2).map((a) => `VP of ${a}`), `${noun} VP`,
  ]
  return {
    slug: `vp-of-${slugNoun}`,
    level: 'vp',
    name: `VP of ${noun}`,
    short: `VP of ${noun}`,
    spelled: `Vice President of ${noun}`,
    acronym: 'VP',
    fn: f.fn,
    ladder: f.key,
    variants,
    aliases: [
      `vice-president-of-${slugNoun}`, `vp-${slugNoun}`, `${slugNoun}-vp`, `svp-of-${slugNoun}`, `svp-${slugNoun}`, `senior-vice-president-of-${slugNoun}`,
      `evp-of-${slugNoun}`, `evp-${slugNoun}`, `executive-vice-president-of-${slugNoun}`, ...f.alt.flatMap((a) => { const s = a.toLowerCase().replace(/[^a-z0-9]+/g, '-'); return [`vp-of-${s}`, `vice-president-of-${s}`] }),
    ],
    owns: `A vice president of ${noun.toLowerCase()} runs ${f.owns} for a company or a large business unit.`,
    sits: 'Usually reports to a C-suite leader or the CEO, and manages directors. SVP and EVP titles are the same job at a larger scale, and are counted here.',
    names: levelPatterns(f, VP_WORD),
    acronyms: [],
    exclude: new RegExp(`${NOT_VP.source}|${NOT_THE_LEADER.source}${f.key === 'security' ? '|\\b(?:insurance|underwriting|underwriter|claims)\\b' : ''}`),
  }
}

function directorRole(f: Fn): RoleDef {
  const noun = f.noun
  const slugNoun = noun.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const variants = [
    `Director of ${noun}`, `${noun} Director`, `Director, ${noun}`, `Senior Director of ${noun}`, `Global Director of ${noun}`, `Regional Director of ${noun}`,
    ...f.alt.slice(0, 2).map((a) => `Director of ${a}`),
  ]
  return {
    slug: `director-of-${slugNoun}`,
    level: 'director',
    name: `Director of ${noun}`,
    short: `Director of ${noun}`,
    spelled: `Director of ${noun}`,
    acronym: null,
    fn: f.fn,
    ladder: f.key,
    variants,
    aliases: [`${slugNoun}-director`, `director-${slugNoun}`, `senior-director-of-${slugNoun}`, ...f.alt.flatMap((a) => { const s = a.toLowerCase().replace(/[^a-z0-9]+/g, '-'); return [`director-of-${s}`, `${s}-director`] })],
    owns: `A director of ${noun.toLowerCase()} leads a team inside the function and answers for ${f.owns}.`,
    sits: 'Usually reports to a vice president or a C-suite leader, and manages managers and individual contributors. Senior and global director titles are counted here.',
    names: levelPatterns(f, 'director'),
    acronyms: [],
    exclude: new RegExp(`${NOT_DIRECTOR.source}|${NOT_THE_LEADER.source}|\\bvice president\\b|\\b(?:vp|svp|evp)\\b`),
  }
}

function chiefRole(c: Chief): RoleDef {
  return {
    slug: c.slug,
    level: 'c-suite',
    name: c.name,
    short: c.short,
    spelled: c.spelled,
    acronym: c.acronym,
    fn: c.fn,
    ladder: c.ladder,
    variants: c.variants,
    aliases: c.aliases,
    owns: c.owns,
    sits: c.sits,
    names: [w(c.names)],
    acronyms: c.acronyms ? [w(c.acronyms)] : [],
    acronymGuard: c.acronymGuard,
    exclude: c.exclude ? new RegExp(`${NOT_THE_LEADER.source}|${c.exclude.source}`) : NOT_THE_LEADER,
  }
}

export const ROLES: RoleDef[] = [...CHIEFS.map(chiefRole), ...FUNCTIONS.map(vpRole), ...FUNCTIONS.map(directorRole)]

const BY_SLUG = new Map(ROLES.map((r) => [r.slug, r]))
const BY_ALIAS = new Map<string, RoleDef>()
for (const r of ROLES) for (const a of r.aliases) if (!BY_SLUG.has(a) && !BY_ALIAS.has(a)) BY_ALIAS.set(a, r)

export const roleBySlug = (slug: string): RoleDef | null => BY_SLUG.get(slug) ?? null
/** The role an address stands for: the canonical slug, or one of its aliases (acronym, other word order). */
export const roleForAddress = (slug: string): RoleDef | null => BY_SLUG.get(slug) ?? BY_ALIAS.get(slug) ?? null

/** True when a listing title counts toward the role. */
export function titleIsRole(role: RoleDef, title: string): boolean {
  const t = normalizeTitle(title)
  if (!t || t.length > 120) return false
  if (role.exclude?.test(t)) return false
  if (role.names.some((re) => re.test(t))) return true
  if (role.acronyms.length === 0) return false
  if (!role.acronyms.some((re) => re.test(t))) return false
  return !(role.acronymGuard && role.acronymGuard.test(t))
}

/** Every role a listing title counts toward (a "VP of Sales and Marketing" counts toward both). */
export function rolesForTitle(title: string): RoleDef[] {
  return ROLES.filter((r) => titleIsRole(r, title))
}

/** The other levels of the same function: where a role leads to and comes from. */
export function ladderOf(role: RoleDef): RoleDef[] {
  return ROLES.filter((r) => r.slug !== role.slug && r.ladder === role.ladder && r.level !== role.level)
}

const LEVEL_LABEL: Record<RoleLevel, string> = { 'c-suite': 'C-suite', vp: 'Vice president', director: 'Director' }
export const levelLabel = (l: RoleLevel) => LEVEL_LABEL[l]
