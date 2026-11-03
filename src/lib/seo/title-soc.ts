// Which government occupation (6-digit SOC) a job-title page's employment outlook and AI-use figures describe.
//
// An allowlist, written by hand and checked against the occupation's own definition: a title gets a figure only where one
// occupation honestly stands for it. The general matcher (lib/careers/title-match.ts) is not used here because it returns near
// misses ("account executive" -> advertising managers, "project manager" -> architectural and engineering managers), and a wrong
// number on a public page is worse than none. Titles left out (product manager, customer success, data engineer, account
// manager, chief officers whose job is not one occupation, and the like) show no outlook figure. The page always names the BLS category it
// used, so a reader can see how close the stand-in is. src/test/title-soc.test.ts checks every code exists in the BLS table.

const BY_SOC: Record<string, string[]> = {
  // Computer and mathematical
  '15-1252': ['software engineer', 'software developer', 'software development engineer', 'software dev engineer', 'backend engineer', 'full stack developer', 'full stack engineer', 'full stack software engineer', 'embedded software engineer', 'java developer', 'salesforce developer', 'software engineer i'],
  '15-1253': ['qa engineer', 'software test engineer'],
  '15-1211': ['business systems analyst', 'business system analyst', 'it business analyst', 'programmer analyst'],
  '15-1212': ['security engineer', 'cybersecurity engineer', 'cyber security engineer', 'application security engineer', 'information security analyst'],
  '15-1232': ['information technology specialist', 'it specialist'],
  '15-1242': ['database administrator'],
  '15-1241': ['network engineer', 'network architect'],
  '15-1254': ['front end', 'front end developer', 'front end engineer', 'frontend developer', 'frontend engineer', 'web developer'],
  '17-1011': ['project architect'],
  '43-5061': ['production planner', 'production scheduler'],
  '43-6012': ['legal secretary', 'legal executive assistant', 'legal administrative assistant'],
  '51-1011': ['production supervisor', 'manufacturing supervisor'],
  '15-1244': ['network administrator', 'system administrator', 'systems administrator', 'it systems administrator'],
  '15-2011': ['actuary', 'actuarial analyst'],
  '15-2031': ['operations research analyst'],
  '15-2051': ['data scientist', 'business intelligence analyst'],
  '11-3021': ['software development manager', 'software engineering manager', 'it manager', 'chief technology officer', 'cto', 'chief information officer', 'cio'],
  // Management
  '11-1011': ['chief executive officer'],
  '11-1021': ['general manager', 'operations manager', 'director of operations', 'head of operations', 'vice president of operations', 'vice president operations', 'restaurant general manager', 'store operations manager', 'chief operating officer', 'chief operations officer', 'coo', 'assistant general manager'],
  '11-2021': ['marketing manager', 'product marketing manager', 'brand manager', 'brand marketing manager', 'growth marketing manager', 'marketing director', 'director of marketing', 'vice president of marketing', 'head of marketing', 'field marketing manager', 'chief marketing officer', 'cmo'],
  '11-2022': ['sales manager', 'district sales manager', 'territory sales manager', 'area sales manager', 'regional sales manager', 'commercial sales manager', 'inside sales manager', 'sales director', 'director of sales', 'vice president of sales', 'vp of sales', 'head of sales', 'regional sales director', 'regional vice president of sales', 'chief revenue officer'],
  '11-2032': ['communications manager'],
  '11-3013': ['facilities manager', 'facility manager'],
  '11-3031': ['accounting manager', 'finance manager', 'finance director', 'controller', 'corporate controller', 'plant controller', 'assistant controller', 'treasury manager', 'director of finance', 'vice president of finance', 'head of finance', 'tax manager', 'tax director', 'corporate tax manager', 'fp and a manager', 'branch manager', 'chief financial officer', 'cfo'],
  '11-3051': ['plant manager', 'production manager', 'quality assurance manager', 'quality manager', 'quality control manager', 'director of quality'],
  '11-3061': ['purchasing manager', 'procurement manager', 'sourcing manager', 'strategic sourcing manager', 'director of procurement', 'commodity manager'],
  '11-3071': ['supply chain manager', 'logistics manager', 'director of supply chain', 'director of transportation', 'transportation manager', 'warehouse manager'],
  '11-3121': ['hr manager', 'human resources manager', 'human resources director', 'director of human resources', 'vice president of human resources', 'vice president human resources', 'head of people', 'chief human resources officer', 'chief people officer', 'chro'],
  '11-9021': ['construction manager', 'construction project manager', 'commercial construction project manager'],
  '11-9032': ['assistant principal'],
  '11-9041': ['engineering manager', 'director of engineering', 'vice president of engineering', 'head of engineering'],
  '11-9111': ['medical director', 'clinical director', 'clinical manager', 'practice manager', 'clinic manager', 'director of nursing', 'healthcare operations manager', 'home health clinical manager', 'chief nursing officer', 'dental office manager', 'medical office manager'],
  '11-9141': ['property manager'],
  // Business and financial operations
  '13-1020': ['buyer', 'assistant buyer', 'procurement specialist', 'sourcing specialist', 'strategic procurement specialist', 'contract specialist', 'contract administrator'],
  '13-1031': ['claims adjuster', 'claims examiner', 'field property claims adjuster', 'workers compensation claims adjuster'],
  '13-1041': ['compliance analyst', 'compliance specialist', 'trade compliance analyst'],
  '13-1071': ['recruiter', 'corporate recruiter', 'technical recruiter', 'executive recruiter', 'campus recruiter', 'talent acquisition specialist', 'talent acquisition partner', 'talent acquisition coordinator', 'recruiting coordinator', 'hr generalist', 'hr specialist', 'hr business partner', 'hr partner', 'hr coordinator', 'human resources generalist', 'human resources specialist', 'human resources business partner', 'human resources coordinator', 'strategic hr business partner', 'people partner', 'people business partner'],
  '13-1081': ['logistics specialist', 'logistics management specialist', 'supply chain analyst', 'logistics coordinator', 'logistics analyst'],
  '13-1082': ['project manager', 'it project manager', 'technical project manager', 'engineering project manager'],
  '13-1111': ['management analyst', 'business analyst', 'management and program analyst'],
  '13-1121': ['event coordinator'],
  '13-1141': ['benefits specialist'],
  '13-1151': ['instructional designer'],
  '13-1161': ['marketing specialist', 'digital marketing specialist', 'performance marketing specialist', 'product marketing specialist', 'marketing coordinator'],
  '13-2011': ['accountant', 'staff accountant', 'tax accountant', 'cost accountant', 'project accountant', 'revenue accountant', 'auditor', 'internal auditor'],
  '13-2031': ['budget analyst'],
  '13-2041': ['credit analyst', 'commercial credit analyst'],
  '13-2051': ['financial analyst', 'fp and a analyst'],
  '13-2052': ['financial advisor', 'wealth advisor'],
  '13-2053': ['underwriter', 'commercial underwriter', 'commercial lines underwriter', 'executive underwriter'],
  '13-2072': ['mortgage loan officer', 'home lending advisor', 'commercial lender', 'commercial banker'],
  // Architecture and engineering
  '17-2051': ['civil engineer', 'civil project engineer', 'project civil engineer', 'construction project engineer', 'structural engineer', 'structural project engineer', 'traffic engineer', 'transportation engineer'],
  '17-2061': ['hardware engineer'],
  '17-2071': ['electrical engineer', 'electrical design engineer', 'electrical project engineer'],
  '17-2081': ['environmental engineer'],
  '17-2112': ['industrial engineer', 'manufacturing engineer', 'advanced manufacturing engineer', 'manufacturing process engineer'],
  '17-2141': ['mechanical engineer', 'mechanical design engineer', 'mechanical project engineer'],
  // Science, community, legal, health
  '19-2041': ['environmental scientist', 'environmental specialist'],
  '19-5011': ['ehs specialist', 'safety specialist'],
  '23-1011': ['attorney', 'corporate attorney', 'litigation attorney', 'trial attorney', 'civil litigation attorney', 'real estate attorney', 'counsel', 'corporate counsel', 'general counsel', 'legal counsel', 'commercial counsel', 'assistant general counsel', 'head of legal', 'assistant attorney general'],
  '23-2011': ['paralegal', 'corporate paralegal', 'litigation paralegal', 'personal injury paralegal', 'family law paralegal', 'paralegal specialist', 'legal assistant'],
  '29-1031': ['dietitian'],
  '29-1123': ['physical therapist'],
  '29-1141': ['registered nurse'],
  // Arts, design, media
  '27-1011': ['art director', 'creative director'],
  '27-1024': ['graphic designer', 'brand designer'],
  '27-1025': ['interior designer'],
  '27-3031': ['communications specialist', 'communications coordinator'],
  '27-3042': ['technical writer'],
  '27-3043': ['copywriter'],
  '15-1255': ['ux designer', 'product designer'],
  // Sales and office
  '41-3091': ['account executive', 'business account executive', 'commercial account executive', 'enterprise account executive', 'mid market account executive', 'strategic account executive', 'national account executive', 'key account executive', 'federal account executive', 'territory account executive', 'salesforce account executive', 'sales account executive', 'founding account executive', 'business development representative', 'sales development representative', 'business development associate', 'business development specialist'],
  '41-4011': ['technical sales representative'],
  '41-4012': ['outside sales representative', 'outside sales rep', 'inside sales representative', 'inside sales rep', 'territory sales representative', 'field sales representative'],
  '41-9022': ['commercial real estate agent'],
  '41-9031': ['sales engineer', 'enterprise sales engineer', 'technical sales engineer', 'regional sales engineer', 'inside sales engineer', 'solutions engineer'],
  '43-1011': ['office manager'],
  '43-3021': ['billing specialist'],
  '43-3031': ['accounts payable specialist', 'accounts receivable specialist'],
  '43-3051': ['payroll specialist'],
  '43-6011': ['executive assistant', 'executive administrative assistant'],
  '43-6014': ['administrative assistant', 'administrative specialist'],
  '43-9061': ['office assistant'],
}

const LEVEL = new Set(['senior', 'sr', 'junior', 'jr', 'associate', 'staff', 'lead', 'principal', 'i', 'ii', 'iii', 'iv', 'v', 'remote', 'entry', 'level'])

/** A title with its level words removed ("Senior Accountant II" -> "accountant"), lower case, words separated by spaces. */
export function baseTitle(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((w) => w && !LEVEL.has(w))
    .join(' ')
}

const SOC_BY_BASE = new Map<string, string>()
const DUPES: string[] = []
for (const [soc, titles] of Object.entries(BY_SOC)) {
  for (const t of titles) {
    const b = baseTitle(t)
    if (SOC_BY_BASE.has(b) && SOC_BY_BASE.get(b) !== soc) DUPES.push(b)
    SOC_BY_BASE.set(b, soc)
  }
}

/** Titles listed under two different occupations (a mistake; the test fails on any). */
export const titleSocDuplicates = (): string[] => DUPES

export const TITLE_SOC_CODES: string[] = Object.keys(BY_SOC)

/** The SOC for a title page, or null when no occupation honestly stands for it. */
export function socForTitle(name: string): string | null {
  return SOC_BY_BASE.get(baseTitle(name)) ?? null
}
