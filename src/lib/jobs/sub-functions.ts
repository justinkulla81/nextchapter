// Sub-functions: the finer kind of work inside the broad functions, so "Your field" on a
// Narrow board means supply chain for a supply-chain leader, not every Operations job.
// Pure (no I/O), unit-tested in src/test/sub-functions.test.ts.
//
// Owner's rule: explicit allowlists only, never a blanket rule. A job or member gets a
// sub-function only when its title matches one of the patterns below or its O*NET
// occupation is listed below; anything else stays without one (null) and is never
// guessed into the nearest bucket. Titles are tried first, in the order listed, so the
// more specific kind of work wins ("Revenue Operations Manager" is revenue ops, not
// business ops).
//
// Adjacent sub-functions are listed by hand too: on Wide, jobs in an adjacent
// sub-function of the member's own function show as "Related field".

export interface SubFunction {
  key: string
  label: string
  /** The broad function it belongs to: a member function (PRIMARY_FUNCTION_OPTIONS) or the crawler's label for it. */
  fn: 'Operations' | 'Engineering' | 'Finance' | 'Human Resources' | 'Sales'
  /** Matched against the lowercased title. */
  titles: RegExp
  /** O*NET-SOC codes that are this kind of work and nothing else. */
  socs: string[]
  /** Sub-functions of the same function close enough to show on Wide as "Related field". */
  adjacent: string[]
}

export const SUB_FUNCTIONS: SubFunction[] = [
  // ── Operations ───────────────────────────────────────────────────────────────
  {
    key: 'ops_revenue',
    label: 'Revenue and sales operations',
    fn: 'Operations',
    titles: /\b(revenue operations|revops|sales operations|sales ops|deal desk|commercial operations|go[- ]to[- ]market operations|gtm operations|marketing operations|salesforce administrator|crm (administrator|manager))\b/,
    socs: [],
    adjacent: ['ops_business', 'ops_customer'],
  },
  {
    key: 'ops_supply_chain',
    label: 'Supply chain and logistics',
    fn: 'Operations',
    titles: /\b(supply chain|logistics|procurement|purchasing|strategic sourcing|sourcing (manager|director|lead|specialist)|inventory|warehouse|distribution (center|centre|manager|director|operations)|fulfill?ment|materials (manager|management|planner)|demand planning|supply planning|s&op|buyer|transportation (manager|director|planner)|fleet (manager|director)|import|export|customs|category manager)\b/,
    socs: ['13-1081.00', '13-1081.01', '13-1081.02', '11-3071.00', '11-3071.01', '11-3071.04', '13-1023.00', '11-3061.00', '43-5011.00', '43-5061.00', '53-1047.00'],
    adjacent: ['ops_manufacturing', 'ops_facilities'],
  },
  {
    key: 'ops_manufacturing',
    label: 'Manufacturing and plant operations',
    fn: 'Operations',
    titles: /\b(manufacturing|plant (manager|director|operations|superintendent)|production (manager|supervisor|director|planner|operations)|operational excellence|operations excellence|continuous improvement|lean|six sigma|quality (manager|director|assurance|control)|shift (manager|supervisor)|assembly|fabrication|machining)\b/,
    socs: ['11-3051.00', '11-3051.01', '11-3051.02', '11-3051.03', '11-3051.04', '11-3051.06', '51-1011.00', '17-2112.00', '17-2112.01', '11-9199.04'],
    adjacent: ['ops_supply_chain', 'ops_facilities'],
  },
  {
    key: 'ops_facilities',
    label: 'Facilities and workplace',
    fn: 'Operations',
    titles: /\b(facilit(y|ies)|maintenance (manager|director|supervisor)|workplace (services|experience|operations)|real estate|property (manager|management)|building (operations|services|manager|engineer)|custodial|janitorial|grounds|environmental services|space planning|campus operations)\b/,
    socs: ['11-3013.00', '11-3013.01', '11-9141.00', '49-1011.00', '37-1011.00', '37-1012.00'],
    adjacent: ['ops_supply_chain', 'ops_manufacturing'],
  },
  {
    key: 'ops_customer',
    label: 'Customer operations',
    fn: 'Operations',
    titles: /\b(customer (operations|service|support|care)|contact (center|centre)|call (center|centre)|service delivery|client (operations|services)|support operations|member services|patient access)\b/,
    socs: ['43-4051.00', '43-1011.00'],
    adjacent: ['ops_business', 'ops_revenue'],
  },
  {
    key: 'ops_projects',
    label: 'Project and program management',
    fn: 'Operations',
    titles: /\b(project manager|project management|program manager|program management|programme manager|project director|program director|pmo|project coordinator|program coordinator|project lead|scrum master|delivery manager|portfolio manager, (projects|programs))\b/,
    socs: ['13-1082.00', '15-1299.09', '11-9021.00'],
    adjacent: ['ops_business'],
  },
  {
    key: 'ops_business',
    label: 'Business and strategy operations',
    fn: 'Operations',
    // The generic operations leadership titles are listed here on purpose (owner's call):
    // "Director of Operations" and "VP Operations" are business operations roles.
    titles: /\b(business operations|bizops|strategy (and|&) operations|strategic operations|operations strategy|chief of staff|chief operating officer|coo|general manager|(director|vp|vice president|head|manager|senior manager|associate director|svp|evp)(,| of)? operations|operations (director|manager|lead|leader)|program operations|operations analyst|business analyst)\b/,
    socs: ['11-1021.00', '13-1111.00', '11-9199.00'],
    adjacent: ['ops_revenue', 'ops_customer', 'ops_projects'],
  },

  // ── Engineering ──────────────────────────────────────────────────────────────
  {
    key: 'eng_security',
    label: 'Security engineering',
    fn: 'Engineering',
    titles: /\b(security|cyber ?security|infosec|appsec|penetration test|soc analyst|identity and access|iam engineer)\b/,
    socs: ['15-1212.00', '15-1299.05', '15-1299.06'],
    adjacent: ['eng_infrastructure'],
  },
  {
    key: 'eng_hardware',
    label: 'Hardware and physical engineering',
    fn: 'Engineering',
    titles: /\b(mechanical|electrical|hardware|civil|structural|chemical|aerospace|biomedical|manufacturing engineer|process engineer|industrial engineer|firmware|embedded|rf engineer|controls engineer|environmental engineer)\b/,
    socs: ['17-2141.00', '17-2071.00', '17-2061.00', '17-2051.00', '17-2041.00', '17-2011.00', '17-2031.00', '17-2112.00', '17-2081.00', '17-2199.00', '17-2072.00'],
    adjacent: [],
  },
  {
    key: 'eng_qa',
    label: 'Quality and test engineering',
    fn: 'Engineering',
    titles: /\b(qa|quality assurance|test (engineer|automation|lead|manager)|sdet|software tester)\b/,
    socs: ['15-1253.00'],
    adjacent: ['eng_software'],
  },
  {
    key: 'eng_infrastructure',
    label: 'Infrastructure, cloud and IT',
    fn: 'Engineering',
    titles: /\b(devops|dev ops|site reliability|sre|infrastructure|cloud (engineer|architect|operations)|platform engineer|systems engineer|network (engineer|architect|administrator)|systems administrator|sysadmin|database administrator|dba|it (manager|director|operations|support)|help ?desk|desktop support)\b/,
    socs: ['15-1244.00', '15-1241.00', '15-1241.01', '15-1299.08', '15-1242.00', '15-1232.00', '15-1231.00'],
    adjacent: ['eng_software', 'eng_security'],
  },
  {
    key: 'eng_software',
    label: 'Software engineering',
    fn: 'Engineering',
    titles: /\b(software|developer|full[- ]?stack|front[- ]?end|back[- ]?end|mobile engineer|ios|android|web developer|programmer|engineering manager|(director|vp|vice president|head) of engineering|machine learning engineer|ml engineer|ai engineer)\b/,
    socs: ['15-1252.00', '15-1254.00', '15-1251.00', '15-1255.00'],
    adjacent: ['eng_infrastructure', 'eng_qa'],
  },

  // ── Finance ──────────────────────────────────────────────────────────────────
  {
    key: 'fin_fpa',
    label: 'FP&A and corporate finance',
    fn: 'Finance',
    titles: /\b(fp&a|fp & a|financial planning|budget|forecast|financial analyst|finance business partner|corporate finance|strategic finance|finance manager|pricing analyst)\b/,
    socs: ['13-2051.00', '13-2031.00'],
    adjacent: ['fin_accounting', 'fin_leadership', 'fin_treasury'],
  },
  {
    key: 'fin_accounting',
    label: 'Accounting, tax and audit',
    fn: 'Finance',
    titles: /\b(accountant|accounting|controller|comptroller|bookkeep|audit|auditor|cpa|tax|payroll|accounts (payable|receivable)|general ledger|billing|revenue (accounting|recognition)|reconciliation)\b/,
    socs: ['13-2011.00', '13-2082.00', '43-3031.00', '43-3051.00', '13-2081.00'],
    adjacent: ['fin_fpa', 'fin_leadership'],
  },
  {
    key: 'fin_treasury',
    label: 'Treasury, investments and capital markets',
    fn: 'Finance',
    titles: /\b(treasury|treasurer|investment|portfolio|asset management|capital markets|investor relations|m&a|mergers|corporate development|valuation|private equity|venture|wealth|equity research)\b/,
    socs: ['13-2052.00', '13-2099.01', '11-3031.03', '41-3031.00'],
    adjacent: ['fin_fpa', 'fin_risk'],
  },
  {
    key: 'fin_risk',
    label: 'Risk, credit and lending',
    fn: 'Finance',
    titles: /\b(risk (manager|analyst|director|officer)|credit|underwrit|loan|lending|collections|actuar)\b/,
    socs: ['13-2041.00', '13-2072.00', '13-2053.00', '15-2011.00', '13-2054.00'],
    adjacent: ['fin_treasury'],
  },
  {
    key: 'fin_leadership',
    label: 'Finance leadership',
    fn: 'Finance',
    titles: /\b(chief financial officer|cfo|(vp|vice president|director|head|svp|evp)(,| of)? finance|finance (director|lead|leader))\b/,
    socs: ['11-3031.00', '11-3031.01'],
    adjacent: ['fin_fpa', 'fin_accounting'],
  },

  // ── People ───────────────────────────────────────────────────────────────────
  {
    key: 'hr_talent_acquisition',
    label: 'Recruiting and talent acquisition',
    fn: 'Human Resources',
    titles: /\b(recruit|recruiting|recruiter|talent acquisition|sourcer|talent partner|head of talent|campus recruiting|executive search)\b/,
    socs: [],
    adjacent: ['hr_partner'],
  },
  {
    key: 'hr_comp_benefits',
    label: 'Compensation and benefits',
    fn: 'Human Resources',
    titles: /\b(compensation|benefits|total rewards|rewards|payroll|equity administration|leave of absence)\b/,
    socs: ['13-1141.00', '11-3111.00'],
    adjacent: ['hr_systems', 'hr_partner'],
  },
  {
    key: 'hr_learning',
    label: 'Learning and organizational development',
    fn: 'Human Resources',
    titles: /\b(learning|training|talent development|organi[sz]ational development|organi[sz]ational effectiveness|l&d|instructional designer|leadership development|talent management)\b/,
    socs: ['11-3131.00', '13-1151.00'],
    adjacent: ['hr_partner'],
  },
  {
    key: 'hr_systems',
    label: 'HR operations and systems',
    fn: 'Human Resources',
    titles: /\b(hris|people operations|hr operations|people systems|workday|hr technology|people analytics|hr analyst|hr coordinator|hr shared services)\b/,
    socs: [],
    adjacent: ['hr_comp_benefits', 'hr_partner'],
  },
  {
    key: 'hr_partner',
    label: 'HR business partnering and employee relations',
    fn: 'Human Resources',
    titles: /\b(hr business partner|hrbp|people partner|human resources (generalist|manager|director|business partner)|hr (generalist|manager|director)|employee relations|labor relations|chief people officer|chief human resources officer|chro|(vp|vice president|head|director)(,| of)? (people|human resources|hr))\b/,
    socs: ['11-3121.00', '13-1075.00', '13-1071.00'],
    adjacent: ['hr_systems', 'hr_learning', 'hr_comp_benefits', 'hr_talent_acquisition'],
  },

  // ── Sales ────────────────────────────────────────────────────────────────────
  {
    key: 'sales_presales',
    label: 'Solutions and presales',
    fn: 'Sales',
    titles: /\b(solutions? (engineer|consultant|architect)|sales engineer|pre-?sales|technical sales|value engineer)\b/,
    socs: ['41-9031.00'],
    adjacent: ['sales_new_business'],
  },
  {
    key: 'sales_development',
    label: 'Sales development',
    fn: 'Sales',
    titles: /\b(sales development|business development representative|sdr|bdr|inside sales|lead generation)\b/,
    socs: [],
    adjacent: ['sales_new_business'],
  },
  {
    key: 'sales_partnerships',
    label: 'Partnerships and channel',
    fn: 'Sales',
    titles: /\b(partnerships?|channel (sales|manager|partner)|alliances|reseller)\b/,
    socs: [],
    adjacent: ['sales_new_business', 'sales_account_management'],
  },
  {
    key: 'sales_account_management',
    label: 'Account management',
    fn: 'Sales',
    titles: /\b(account manager|account management|client (manager|partner|director)|key account|strategic account|relationship manager|client relationship)\b/,
    socs: [],
    adjacent: ['sales_new_business', 'sales_partnerships'],
  },
  {
    key: 'sales_leadership',
    label: 'Sales leadership',
    fn: 'Sales',
    titles: /\b(chief revenue officer|cro|chief sales officer|(vp|vice president|svp|evp|director|head|avp)(,| of)? sales|sales (director|manager|leader)|regional sales)\b/,
    socs: ['11-2022.00'],
    adjacent: ['sales_new_business', 'sales_account_management'],
  },
  {
    key: 'sales_new_business',
    label: 'New business sales',
    fn: 'Sales',
    titles: /\b(account executive|business development|new business|sales (executive|representative|rep|consultant|specialist)|territory (manager|sales)|enterprise sales)\b/,
    socs: [],
    adjacent: ['sales_development', 'sales_account_management', 'sales_leadership'],
  },
]

export const SUB_FUNCTION_BY_KEY: ReadonlyMap<string, SubFunction> = new Map(SUB_FUNCTIONS.map((s) => [s.key, s]))

// The crawler's labels for these functions (job-functions.ts) and the member's own match;
// "People" is the crawler's code for Human Resources.
const FN_KEYS = new Map<string, SubFunction['fn']>([
  ['operations', 'Operations'],
  ['engineering', 'Engineering'],
  ['finance', 'Finance'],
  ['human resources', 'Human Resources'],
  ['people', 'Human Resources'],
  ['sales', 'Sales'],
])

/** Whether a function (member or job, any case) is split into sub-functions. */
export function hasSubFunctions(fn: string | null | undefined): boolean {
  return FN_KEYS.has((fn ?? '').trim().toLowerCase())
}

const BY_FN = new Map<string, SubFunction[]>()
for (const s of SUB_FUNCTIONS) BY_FN.set(s.fn, [...(BY_FN.get(s.fn) ?? []), s])
const BY_SOC = new Map<string, SubFunction>()
for (const s of SUB_FUNCTIONS) for (const soc of s.socs) if (!BY_SOC.has(soc)) BY_SOC.set(soc, s)

/**
 * The sub-function of a job or a member's latest role: the first allowlisted title
 * pattern within its function, else an allowlisted O*NET occupation in that function.
 * Null when the function isn't split, or nothing on the lists matches.
 */
export function subFunctionFor(input: { title: string | null | undefined; fn: string | null | undefined; soc?: string | null }): string | null {
  const fn = FN_KEYS.get((input.fn ?? '').trim().toLowerCase())
  if (!fn) return null
  const title = (input.title ?? '').toLowerCase().replace(/\s+/g, ' ')
  if (title) for (const s of BY_FN.get(fn)!) if (s.titles.test(title)) return s.key
  const bySoc = input.soc ? BY_SOC.get(input.soc) : undefined
  return bySoc && bySoc.fn === fn ? bySoc.key : null
}

/** Is `job` the member's sub-function's neighbour (same function, hand-listed adjacency, either direction)? */
export function adjacentSubFunctions(a: string, b: string): boolean {
  const sa = SUB_FUNCTION_BY_KEY.get(a)
  const sb = SUB_FUNCTION_BY_KEY.get(b)
  if (!sa || !sb || sa.fn !== sb.fn || a === b) return false
  return sa.adjacent.includes(b) || sb.adjacent.includes(a)
}

export function subFunctionLabel(key: string | null | undefined): string | null {
  return (key && SUB_FUNCTION_BY_KEY.get(key)?.label) || null
}
