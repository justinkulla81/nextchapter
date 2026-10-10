import type { CompanySizeBand } from '@prisma/client'
import { PRIMARY_FUNCTION_OPTIONS, HIGHEST_LEVEL_OPTIONS } from '@/lib/constants/onboarding'
import { calibratedLevelRank } from '@/lib/scoring/level-rank'

// Best-effort mapping from a free-text job title (all we get from an ATS
// feed before a human ever looks at it) to the same function vocabulary
// candidates pick from in onboarding. Ordered most-specific-first so, e.g.,
// "Data Engineer" lands on Engineering rather than Data & Analytics, and a
// C-suite title lands on Executive Leadership rather than its functional
// area. Returns null when nothing matches confidently — callers should
// treat null as "don't filter on this," not "no candidates fit."
const FUNCTION_KEYWORDS: { function: (typeof PRIMARY_FUNCTION_OPTIONS)[number]; keywords: string[] }[] = [
  // Checked before the C-suite acronyms below so a support title like
  // "Executive Assistant to the CEO" lands on Administration rather than
  // matching the bare "ceo" substring.
  { function: 'Administration', keywords: ['administrative assistant', 'office manager', 'executive assistant'] },
  // The bare 3-letter acronyms (ceo/coo/cfo/cto/cmo/cpo) are handled
  // separately via EXEC_ACRONYM_PATTERN below, not as plain substrings here —
  // see that constant's comment for why (they collide with ordinary words).
  { function: 'Executive Leadership', keywords: ['chief executive', 'chief operating', 'chief financial', 'chief technology', 'chief marketing', 'chief product', 'chief people', 'chief revenue', 'chief legal', 'general manager', 'president'] },
  { function: 'Legal', keywords: ['legal', 'counsel', 'attorney', 'compliance', 'paralegal'] },
  { function: 'Human Resources', keywords: ['human resources', 'recruiter', 'recruiting', 'talent acquisition', 'people partner', 'people operations', 'hrbp'] },
  { function: 'Data & Analytics', keywords: ['data scientist', 'data analyst', 'analytics', 'business intelligence', 'bi analyst', 'machine learning engineer', 'ml engineer', 'data & ai', 'data and ai'] },
  { function: 'Engineering', keywords: ['engineer', 'developer', 'software', 'devops', 'site reliability', 'sre', 'architect', 'programmer', 'qa engineer'] },
  { function: 'Design', keywords: ['designer', 'ux', 'ui/ux', 'product design', 'creative director'] },
  { function: 'Product', keywords: ['product manager', 'product owner', 'product lead'] },
  { function: 'Marketing', keywords: ['marketing', 'growth marketer', 'brand manager', 'demand generation', 'seo specialist', 'content strategist'] },
  { function: 'Sales', keywords: ['account executive', 'business development', 'sales representative', 'sales manager', 'sdr', 'bdr', 'sales director'] },
  { function: 'Customer Success', keywords: ['customer success', 'customer support', 'client success', 'implementation manager'] },
  // 'finance' / 'financial' were missing, so "Head of Finance", "Director of Finance" and
  // "VP of Finance" had NO function (~1,600 live jobs). Safe here because every more
  // specific function above is checked first ("Finance Systems Engineer" is Engineering,
  // "Sales Manager, Financial Services" is Sales) and retail-banking phrases are
  // neutralised below.
  { function: 'Finance', keywords: ['accountant', 'accounting', 'controller', 'fp&a', 'treasury', 'financial analyst', 'finance', 'financial'] },
  { function: 'Operations', keywords: ['operations', 'supply chain', 'logistics'] },
]

// Single-word keywords common enough in everyday English to describe jobs
// that have nothing to do with the function they're filed under here —
// "operations" shows up in Facilities/IT/Warehouse/Fraud Operations just as
// often as the general biz-ops sense meant here (a "Facilities Operations
// Manager" is not a business-operations candidate's peer), and bare
// "president" is a substring of "vice president" at any level in any
// function, so e.g. "VP of Engineering" was misclassifying as Executive
// Leadership. Verified against ~6,750 real live ATS titles: requiring 2+
// keyword hits as a *blanket* rule wipes out ~55% of genuinely correct
// single-keyword matches (Software Engineer, Sales Director, etc.), so the
// fix is scoped to just these two known offenders — a solo hit on one of
// these needs a second corroborating keyword from the same entry (e.g.
// "supply chain manager") before counting as confident.
const AMBIGUOUS_SOLO_KEYWORDS = new Set(['operations', 'president'])

// The bare 3-letter C-suite acronyms need a word-boundary check, not a
// plain substring match — "cto" is a literal substring of "director"
// (dire-CTO-r), "contractor", "doctor", "factory", "sector", and "actor";
// "coo" is a substring of "coordinator"/"cooperate". Checked as plain
// .includes() keywords, any of those ordinary titles were silently
// misclassifying as Executive Leadership / C-Suite for every candidate,
// regardless of the candidate's own level — a live bug, not hypothetical
// (surfaced by an "Executive Director" posting reading as C-Suite here).
const EXEC_ACRONYM_PATTERN = /\b(?:ceo|coo|cfo|cto|cmo|cpo)\b/

// "Administrative Business Partner, Office of the CEO" is a support role
// that works FOR an executive, not the executive themselves — but "office
// of the ceo" contains the bare substring "ceo", so it was matching the
// Executive Leadership function and C-Suite level the same way an actual
// CEO title would. Neutralize the acronym/title inside this specific
// "office of the ___" phrasing before running the keyword scan, for both
// function and level inference.
function stripExecutiveOfficePhrase(lower: string): string {
  return lower.replace(/\boffice of the (chief \w+( \w+)?|ceo|coo|cfo|cto|cmo|cpo|president)\b/g, 'office of the executive')
}

// A bank branch ("Financial Center Manager") or a wealth-management seller ("Financial
// Advisor") is not the finance function, though the word is in the title.
function stripRetailFinancePhrases(lower: string): string {
  return lower.replace(/\bfinancial (center|centre|advisor|adviser|planner|consultant|solutions advisor)s?\b/g, 'banking $1')
}

// Second pass, only when the keyword list above matched nothing — so a title it already
// classifies can never change. About half of the live board (~37,000 jobs) had no function
// because the list recognises narrow phrases ("sales director") but not the same thing
// phrased differently ("Director of Sales", "Head of Sales", "VP of Product", "Tax
// Manager"). These rules read the structure instead: a leadership or manager word beside
// a function word, with the words that make a function-word mean something else (a
// "facilities operations" role, a "store" manager) excluded.
//
// Order matters: most specific first. Titles that are genuinely not corporate functions
// (nurse, dean, deli manager, superintendent) stay null, which callers read as "don't
// filter on this" — better than forcing them into a function they are not.
const LEAD = '(?:head|director|vp|vice president|svp|evp|avp|chief|president|manager|lead|leader|principal|partner)'
const ROLE = '(?:manager|director|head|lead|executive|representative|rep|specialist|consultant|associate|analyst|coordinator|officer|partner|strategist|leader)'
const NOT_BUSINESS_OPS =
  /\b(facilit\w*|warehouse|plant|store|fraud|clinical|network|branch|site|field|hospital|security|call cent\w*|data cent\w*|restaurant|retail|kitchen|dining|stadium|fleet|rig|mine|mining|pharmacy|nursing|patient|surgical|farm)\b/

// Built with new RegExp(): in a template literal "\\b" is the regex word boundary.
const w = (words: string) => `\\b(?:${words})\\b`

const PHRASE_RULES: { fn: string; re: RegExp; unless?: RegExp }[] = [
  {
    fn: 'Executive Leadership',
    re: /\b(chief of staff|managing director|general manager|executive director|founder|co-founder|president)\b/,
    unless: /\b(vice president|vp|svp|evp|avp|assistant to)\b/,
  },
  {
    fn: 'Human Resources',
    re: new RegExp(
      `${w('people|talent|culture|learning and development|learning & development|l&d|hr|employee experience|total rewards|compensation|benefits')}.*${w(ROLE)}|${w(LEAD)}.*${w('people|talent|human capital|hr')}`
    ),
    unless: /\bworkers?'?\s*comp(ensation)?\b|\bclaims?\b/,
  },
  {
    fn: 'Legal',
    re: new RegExp(
      `${w('regulatory|privacy|ethics|government affairs|public policy|legal|contracts?')}.*${w(ROLE)}|${w(LEAD)}.*${w('regulatory|privacy|government affairs|legal')}`
    ),
  },
  {
    fn: 'Finance',
    re: new RegExp(
      `${w('tax|audit|actuar\\w*|treasury|payroll|billing|credit|underwrit\\w*|investor relations|risk')}.*${w(ROLE)}|${w(LEAD)}.*${w('tax|audit|actuarial|treasury|payroll|investor relations|accounting')}`
    ),
  },
  {
    fn: 'Product',
    re: new RegExp(`${w(LEAD)}.*\\bproduct\\b(?!\\s*(design|marketing|support|operations|engineer))|\\bproduct\\s+(management|strategy|lead|leader)\\b|\\bgroup product\\b`),
    unless: /\b(android|ios|software|firmware|embedded|backend|frontend|front-end|back-end|engineer\w*|new product introduction|npi|manufactur\w*|insurance|safety|testing|quality)\b/,
  },
  {
    fn: 'Marketing',
    re: new RegExp(
      `${w('communications?|brand|content|public relations|pr|community|growth|lifecycle|crm|events?|social media|creative|media')}.*${w(ROLE)}|${w(LEAD)}.*${w('communications?|brand|content|public relations|growth|marketing')}`
    ),
    unless: /\bcommunity (development|health|engagement|outreach|services)\b|\bclinical\b|\bcategory manager\b|\bfederal\b/,
  },
  {
    fn: 'Sales',
    re: new RegExp(
      `${w(LEAD)}.*\\bsales\\b|\\bsales\\b.*${w(ROLE)}|${w('account manager|account director|territory manager|channel|partnerships?|commercial|revenue|inside sales|key account|enterprise account|relationship manager|business development|solutions? consultant|customer acquisition')}`
    ),
    unless: /\b(construction|real estate|architect\w*|engineering|superintendent|estimator|preconstruction)\b/,
  },
  {
    fn: 'Customer Success',
    re: new RegExp(`\\b(customer|client)\\s+(experience|services?|operations|care|support|onboarding|engagement)\\b|\\bcustomer success\\b|\\bsupport\\s+${w(ROLE)}|${w(LEAD)}.*\\bcustomer\\b`),
  },
  {
    fn: 'Data & Analytics',
    re: new RegExp(
      `${w('data|analytics|insights?|business intelligence|reporting|research')}.*${w(ROLE)}|${w(LEAD)}.*${w('data|analytics|insights|business intelligence')}`
    ),
    unless: /\bdata\s*cent(er|re)s?\b|\bconstruction\b|\bmep\b|\binfrastructure\b|\bnetwork\b/,
  },
  {
    fn: 'Design',
    re: /\b(creative|ux|ui|product design|brand design|visual|graphic|interaction|industrial design|experience design|design systems?)\b.*\b(director|head|lead|manager)\b|\b(director|head|vp|vice president)\b.*\b(creative|ux|ui|product design|brand design|graphic)\b|\b(head|director|vp) of design\b/,
    unless: /\b(electrical|mechanical|civil|structural|network|systems? engineer\w*|automation|construction|facilit\w*|audio|mep|hvac|plumbing|interior|workplace)\b/,
  },
  {
    fn: 'Engineering',
    re: new RegExp(
      `${w('information technology|it|cyber\\s?security|information security|infosec|cloud|infrastructure|platform|systems?|technology|devsecops|technical')}.*${w('director|head|vp|vice president|manager|lead|architect|chief')}|${w('chief|head|vp|vice president|director')}.*${w('technology|information technology|information security|engineering')}`
    ),
    unless: /\b(technical (account|program|project|sales|recruit|writer|support|operations)|account|sales|program|project|customer|clinical|product|quality|launch|programs?)\b/,
  },
  // Project / program / production management: operations in the general-management sense.
  { fn: 'Operations', re: /\b(project|program|programme|portfolio|delivery|transformation|change|implementation)\s+(manager|director|lead|management|office|officer|head)\b|\bpmo\b/ },
  {
    fn: 'Operations',
    re: /\b(plant|production|manufacturing|quality|maintenance|continuous improvement|lean|six sigma|process improvement|supply chain|procurement|sourcing|purchasing|logistics|distribution|fulfillment|inventory|planning)\b.*\b(manager|director|head|lead|vp|vice president|supervisor|engineer)\b/,
    unless: /\b(software|data|product|sales|marketing|hr|financial|clinical|nurse|patient)\b/,
  },
  {
    fn: 'Operations',
    re: new RegExp(`${w('operations?')}.*${w('manager|director|head|lead|vp|vice president|officer|executive')}|${w(LEAD)}.*${w('operations?')}`),
    unless: NOT_BUSINESS_OPS,
  },
]

function inferByStructure(lower: string): string | null {
  for (const rule of PHRASE_RULES) {
    if (rule.re.test(lower) && !(rule.unless && rule.unless.test(lower))) return rule.fn
  }
  return null
}

export function inferFunctionFromTitle(title: string): string | null {
  const lower = stripRetailFinancePhrases(stripExecutiveOfficePhrase(title.toLowerCase()))
  for (const entry of FUNCTION_KEYWORDS) {
    const hits = entry.keywords.filter((kw) => lower.includes(kw))
    const matchesExecAcronym = entry.function === 'Executive Leadership' && EXEC_ACRONYM_PATTERN.test(lower)
    if (hits.length === 0 && !matchesExecAcronym) continue
    const weak = hits.length === 1 && !matchesExecAcronym && AMBIGUOUS_SOLO_KEYWORDS.has(hits[0])
    if (!weak) return entry.function
  }
  return inferByStructure(lower)
}

// Same best-effort keyword approach, for seniority instead of function.
// Checked most-senior-first so "VP of Engineering" doesn't fall through to
// a lower band via some coincidental substring. Titles with no management
// keyword default to 'IC' rather than null — the overwhelming majority of
// unlabeled titles (engineer, analyst, specialist, representative) really
// are individual-contributor roles, and this is only ever used as a soft
// match signal, never a hard gate.
const LEVEL_KEYWORDS: { level: (typeof HIGHEST_LEVEL_OPTIONS)[number]; keywords: string[] }[] = [
  // Bare acronyms (ceo/coo/cfo/cto/cmo/cpo) handled via EXEC_ACRONYM_PATTERN
  // below, not as plain substrings here — see that constant's comment.
  { level: 'C-Suite', keywords: ['chief executive', 'chief operating', 'chief financial', 'chief technology', 'chief marketing', 'chief product', 'chief people', 'chief revenue', 'chief legal', 'president', 'partner'] },
  { level: 'VP', keywords: ['vice president', ' vp ', 'vp,', 'vp of', 'svp', 'evp'] },
  // "Head of X" is a director-equivalent title at most companies (it names
  // ownership of a whole function, not a single team) — checked before
  // Manager below so it doesn't fall through to that lower band.
  { level: 'Director', keywords: ['director', 'head of'] },
  { level: 'Manager', keywords: ['manager', 'team lead'] },
]

// "Partner" only means firm-equity seniority when it stands on its own
// ("Partner", "Managing Partner", "General Partner"). Preceded by a function
// qualifier it's an ordinary staff title: an HR Business Partner is an IC,
// and an "Administrative Business Partner" is an executive assistant.
//
// This was a live bug, not a hypothetical. The bare 'partner' C-Suite
// keyword classified that whole title family as C-Suite, and the ATS feed's
// level gate (ats-job-board-feed.ts — levelDistance <= 1) trusts this
// function, so "Business Partner Analyst" and "Administrative Business
// Partner" were being surfaced to VP/C-suite candidates as matches.
//
// Rewrites the qualifier phrase instead of dropping the word, so a title
// like "Business Partner Analyst" still infers its function normally.
export const STAFF_PARTNER_QUALIFIERS = [
  'business',
  'hr',
  'human resources',
  'people',
  'talent',
  'finance',
  'financial',
  'administrative',
  'admin',
  'channel',
  'delivery',
  'implementation',
  'solutions',
  'customer',
  'account',
  'learning',
]

export function neutralizeStaffPartnerPhrase(lower: string): string {
  const alternation = STAFF_PARTNER_QUALIFIERS.map((q) => q.replace(/ /g, '\\s+')).join('|')
  // One optional word may sit between the qualifier and "partner" — covers
  // "Customer Success Partner", "Talent Acquisition Partner", "People
  // Operations Partner" without needing an entry for every combination.
  // Genuine equity titles ("Managing Partner", "General Partner") don't
  // start with a staff qualifier, so they're untouched.
  return lower.replace(new RegExp(`\\b(${alternation})(\\s+\\w+)?\\s+partner\\b`, 'g'), '$1$2 specialist')
}

// Bare "ED" is corporate shorthand for Executive Director, common in some
// companies' internal title conventions (e.g. "ED, Data & AI, Enterprise").
// The spelled-out "Executive Director" already matches the plain 'director'
// substring above; this two-letter abbreviation needs its own word-boundary
// check so it doesn't collide with ordinary words ending in "...ed" (e.g.
// "Certified", "Related"). Scoped to the Director tier only, checked in the
// same most-senior-first loop below so an explicit VP/C-Suite keyword
// elsewhere in the title still wins.
const BARE_ED_ABBREVIATION = /\bed\b/

// Bare "Principal" (e.g. "Principal" at a PE/VC/consulting firm, "Principal
// and Founding Member") is genuinely Director-equivalent seniority — a real
// gap, not hypothetical (a candidate's "Principal and Founding Member" title
// was defaulting to IC, dragging down their whole career-seniority signal).
// But "Principal Engineer"/"Principal Scientist"/etc. is a common senior-IC
// (not people-manager) tech-ladder title, so this excludes that qualifier
// pattern rather than trusting the bare word everywhere.
const BARE_PRINCIPAL = /\bprincipal\b/
export const PRINCIPAL_IC_QUALIFIER = /\bprincipal\s+(engineer|scientist|architect|developer|consultant|analyst|designer)\b/

// A board seat is a governance-tier role, categorically more senior than an
// internal-org "Director" job title with the same word in it — a real gap,
// not hypothetical (a candidate's "Senior Adviser, Board Director" title was
// landing on the plain Director tier via the bare 'director' substring
// match above, understating what's genuinely an executive/governance-level
// role and dragging down their whole career-seniority signal).
const BOARD_QUALIFIER = /\bboard\s+(director|member|advisor|adviser)\b/

// A bare "Partner" ("Partner", "Managing Partner", "General Partner" —
// anything that survives neutralizeStaffPartnerPhrase's staff-qualifier
// filtering) is genuinely ambiguous seniority: it can mean a junior
// associate track (many law/advisory firms) or true C-suite-equivalent
// firm-equity standing, and title text alone can't tell them apart.
// inferLevelFromTitle's default (treat it as C-Suite) stays the right
// answer for the many context-free callers of that function (job postings,
// rejection-trend analysis) that have no candidate history to disambiguate
// against — this predicate exists so the few callers that DO have real
// context (level-rank-service.ts, resume-analysis/seniority-band.ts) can
// recognize the ambiguous case and resolve it with years/company/prior-title
// signal instead of trusting the bare word. False for any title carrying an
// unambiguous senior signal (an explicit "Chief ___"/"President" phrase, or
// a C-suite acronym) alongside "partner," since that title isn't actually
// ambiguous.
const BARE_PARTNER_PATTERN = /\bpartner\b/
const UNAMBIGUOUS_CSUITE_PHRASE_PATTERN =
  /\b(chief executive|chief operating|chief financial|chief technology|chief marketing|chief product|chief people|chief revenue|chief legal|president)\b/

export function isAmbiguousPartnerTitle(title: string): boolean {
  const lower = neutralizeStaffPartnerPhrase(stripExecutiveOfficePhrase(title.toLowerCase()))
  if (!BARE_PARTNER_PATTERN.test(lower)) return false
  if (EXEC_ACRONYM_PATTERN.test(lower)) return false
  if (UNAMBIGUOUS_CSUITE_PHRASE_PATTERN.test(lower)) return false
  return true
}

// Any "Chief ___ Officer" (Strategy, Investment, Diversity...) — the
// named list above only covered a handful, so "Chief Strategy Officer" fell
// all the way through to IC.
const CHIEF_OFFICER = /\bchief [a-z&,/ -]{2,40}officer\b/

export function inferLevelFromTitle(title: string): string {
  // "Vice President" contains "president" — without this, every VP title
  // read as C-Suite via the bare 'president' keyword.
  const lower = ` ${neutralizeStaffPartnerPhrase(stripExecutiveOfficePhrase(title.toLowerCase())).replace(/\bvice[\s-]+president\b/g, 'vp')} `
  for (const entry of LEVEL_KEYWORDS) {
    const matchesKeyword = entry.keywords.some((kw) => lower.includes(kw))
    const matchesExecAcronym = entry.level === 'C-Suite' && (EXEC_ACRONYM_PATTERN.test(lower) || CHIEF_OFFICER.test(lower))
    const matchesBoardQualifier = entry.level === 'C-Suite' && BOARD_QUALIFIER.test(lower)
    const matchesBareED = entry.level === 'Director' && BARE_ED_ABBREVIATION.test(lower)
    const matchesBarePrincipal =
      entry.level === 'Director' && BARE_PRINCIPAL.test(lower) && !PRINCIPAL_IC_QUALIFIER.test(lower)
    if (matchesKeyword || matchesExecAcronym || matchesBoardQualifier || matchesBareED || matchesBarePrincipal) {
      return entry.level
    }
  }
  return 'IC'
}

// Composes the title-only heuristic above with a known company size — the
// one place job-side company size enters the level-matching path today (see
// ats-job-board-feed.ts, the only caller). See src/lib/scoring/level-rank.ts
// for the calibration math.
export function inferCalibratedLevelRank(title: string, companySizeBand: CompanySizeBand | null): number | null {
  return calibratedLevelRank(inferLevelFromTitle(title), companySizeBand)
}
