// What an internship is about, when it runs, and whether it belongs in a
// college's portal at all. Pure — no database — so the rules are unit-tested
// (src/test/internships.test.ts). The crawler (ncrawl/internships.py) applies
// the same screen; the import route applies it again so nothing it missed lands.
//
// An allowlist, on purpose: an internship is kept only when its title names a
// professional field below. Anything else (retail, warehouse, clinical floor,
// camp, unpaid "opportunities") stays out.

import { INTERN_PROGRAM_STAFF, isInternshipJob } from '@/lib/jobs/work-type'

export const INTERNSHIP_FIELDS = [
  'healthcare',
  'data',
  'software',
  'finance',
  'design',
  'marketing',
  'policy',
  'research',
  'people',
  'engineering',
  'business',
] as const
export type InternshipField = (typeof INTERNSHIP_FIELDS)[number]

/** Label, with the majors it suits — what a student filters by. */
export const INTERNSHIP_FIELD_LABEL: Record<InternshipField, string> = {
  business: 'Business & operations',
  engineering: 'Engineering',
  software: 'Software & computer science',
  data: 'Data & analytics',
  finance: 'Finance & accounting',
  marketing: 'Marketing & communications',
  design: 'Design & UX',
  policy: 'Policy, government & law',
  research: 'Research & science',
  healthcare: 'Healthcare administration',
  people: 'HR & people',
}

export const INTERNSHIP_FIELD_MAJORS: Record<InternshipField, string> = {
  business: 'Business, management, economics',
  engineering: 'Mechanical, electrical, civil, chemical, industrial',
  software: 'Computer science, software, IT, cybersecurity',
  data: 'Statistics, data science, math',
  finance: 'Finance, accounting, economics',
  marketing: 'Marketing, communications, journalism',
  design: 'Design, architecture, HCI',
  policy: 'Political science, public policy, pre-law',
  research: 'Biology, chemistry, physics, life sciences',
  healthcare: 'Health administration, public health',
  people: 'Human resources, psychology, organizational behavior',
}

const FIELD_PATTERNS: [InternshipField, RegExp][] = [
  ['healthcare', /\b(health(care)? (administration|management|operations|policy|informatics|services|finance|analytics)|hospital administration|public health|population health|revenue cycle|patient experience)\b/i],
  ['finance', /\b(financ(e|ial)|accounting|accountant|audit|tax|investment|banking|treasury|actuar(ial|y)|risk management|wealth|equity research|private equity|credit (risk|analys[it]s?)|fp&a|capital markets|private equity|venture|asset management|insurance|underwriting|economics?)\b/i],
  ['data', /\b(data|analytics|machine learning|\bml\b|artificial intelligence|\bai\b|statistic(s|al)|business intelligence|\bbi\b|quantitative|quant)\b/i],
  ['software', /\b(software|developer|programming|computer science|\bswe\b|full[- ]?stack|front[- ]?end|back[- ]?end|web development|mobile|ios|android|devops|cloud|cyber ?security|information security|security engineer|\bit\b|information technology|technology|sre|site reliability|platform engineer|qa engineer|test automation)\b/i],
  ['design', /\b(design|designer|ux|ui|user experience|graphic|creative|architecture|architectural|industrial design|motion|animation|illustrat)/i],
  ['marketing', /\b(marketing|communications?|public relations|\bpr\b|social media|content|brand|digital media|journalism|editorial|copywrit|media|advertising|events?)\b/i],
  ['policy', /\b(policy|government|government affairs|public affairs|legislative|legal|law|paralegal|compliance|regulatory|advocacy|public sector|nonprofit|international (relations|affairs)|economic development|urban planning|sustainability)\b/i],
  ['research', /\b(research|scientist|science|laboratory|\blab\b|r&d|biolog|chemi(stry|cal)|physics|biotech|genomic|neuroscience|clinical research|environmental science)/i],
  ['people', /\b(human resources|\bhr\b|people (operations|team|analytics)|talent acquisition|recruiting|recruitment|learning (and|&) development|dei)\b/i],
  ['engineering', /\b(engineer(ing)?|mechanical|electrical|civil|chemical|aerospace|industrial|manufacturing|hardware|systems|structural|biomedical|controls|robotics|embedded|firmware|process|quality|environmental|energy|power)\b/i],
  ['business', /\b(business|operations|strategy|consulting|consultant|supply chain|procurement|purchasing|logistics|project management|program management|product management|product manager|product|sales|business development|partnerships|real estate|merchandising planning|corporate development|management|commercial|finance and operations|administration|analyst)\b/i],
]

/** The field an internship suits, from its title (and, failing that, its department). Null = not a professional internship we list. */
export function internshipField(title: string, department?: string | null): InternshipField | null {
  for (const [field, re] of FIELD_PATTERNS) if (re.test(title)) return field
  if (department) for (const [field, re] of FIELD_PATTERNS) if (re.test(department)) return field
  return null
}

// Hourly, frontline, clinical-floor and camp work: not what a career office lists.
const NON_PROFESSIONAL =
  /\b(retail|store|cashier|warehouse|driver|delivery|lifeguard|camp counselor|counselor[- ]in[- ]training|barista|server|custodial|janitor|housekeep|landscap|grounds|cook|kitchen|restaurant|sales associate|customer service|call center|teller|merchandiser|pharmacy|pharmacist|nurs(e|ing)|medical intern|surgical|residen(t|cy)|dental|veterinar|physical therap|occupational therap|athletic|fitness|childcare|child care|daycare|babysit|nanny|valet|security guard|production worker|laborer|seasonal associate|brand ambassador|campus ambassador|door[- ]to[- ]door|commission[- ]only|mlm)\b/i
const UNPAID_TITLE = /\b(unpaid|volunteer)\b/i
const UNPAID_TEXT = /\b(this is an? unpaid|unpaid (internship|position|role|opportunity)|(internship|position|role) is unpaid|no (monetary )?compensation|without pay)\b/i
const FOR_CREDIT = /\b(academic|college|course|school|university) credit\b|\bfor credit\b/i

export type InternshipVerdict = { keep: true; field: InternshipField } | { keep: false; reason: string }

/**
 * Whether a posting belongs in a college's Internships tab: an internship or
 * co-op (not a job running an internship program), in a professional field,
 * not frontline work, and not unpaid unless it says it earns academic credit.
 */
export function screenInternship(input: { title: string; description?: string | null; department?: string | null; employmentType?: string | null }): InternshipVerdict {
  const title = input.title.trim()
  // The same test the member board uses to keep internships out (work-type.ts),
  // incl. federal Pathways "Student Trainee (Accounting)" and student co-ops.
  if (!isInternshipJob({ title, employmentType: input.employmentType })) return { keep: false, reason: 'not an internship' }
  if (INTERN_PROGRAM_STAFF.test(title)) return { keep: false, reason: 'runs an internship program (a staff job)' }
  if (NON_PROFESSIONAL.test(title)) return { keep: false, reason: 'frontline or clinical work' }
  if (UNPAID_TITLE.test(title)) return { keep: false, reason: 'unpaid' }
  const text = (input.description ?? '').slice(0, 6000)
  if (UNPAID_TEXT.test(text) && !FOR_CREDIT.test(text)) return { keep: false, reason: 'unpaid without academic credit' }
  const field = internshipField(title, input.department)
  if (!field) return { keep: false, reason: 'no professional field in the title' }
  return { keep: true, field }
}

export const INTERNSHIP_TERMS = ['summer', 'fall', 'spring', 'winter', 'co_op', 'year_round'] as const
export type InternshipTerm = (typeof INTERNSHIP_TERMS)[number]

export const INTERNSHIP_TERM_LABEL: Record<InternshipTerm, string> = {
  summer: 'Summer',
  fall: 'Fall',
  spring: 'Spring',
  winter: 'Winter',
  co_op: 'Co-op',
  year_round: 'Year-round',
}

/** When it runs: the season (or co-op) and year named in the title, else the description's first mention. */
export function internshipTerm(title: string, description?: string | null): { term: InternshipTerm | null; year: number | null } {
  const read = (s: string) => {
    const t = s.toLowerCase()
    const term: InternshipTerm | null = /\bco-?op\b/.test(t)
      ? 'co_op'
      : /\bsummer\b/.test(t)
        ? 'summer'
        : /\b(fall|autumn)\b/.test(t)
          ? 'fall'
          : /\bspring\b/.test(t)
            ? 'spring'
            : /\bwinter\b/.test(t)
              ? 'winter'
              : /\byear[- ]round\b/.test(t)
                ? 'year_round'
                : null
    const y = t.match(/\b(20[2-3]\d)\b/)
    return { term, year: y ? Number(y[1]) : null }
  }
  const fromTitle = read(title)
  if (fromTitle.term) return fromTitle
  const fromText = read((description ?? '').slice(0, 1500))
  return { term: fromText.term, year: fromTitle.year ?? (fromText.term ? fromText.year : null) }
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
}

/** An application deadline the posting states ("Apply by March 1, 2027", "Deadline: 2/15/2027"); null when none. */
export function internshipDeadline(description: string | null | undefined): Date | null {
  const text = (description ?? '').slice(0, 8000)
  const m = text.match(
    /\b(?:apply by|application deadline(?: is)?|deadline to apply(?: is)?|applications? (?:are |is )?due(?: by)?|deadline)[:\s]+(?:(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(20\d\d)|(\d{1,2})\/(\d{1,2})\/(20\d\d))/i,
  )
  if (!m) return null
  const d = m[1]
    ? new Date(Date.UTC(Number(m[3]), MONTHS[m[1].toLowerCase()], Number(m[2])))
    : new Date(Date.UTC(Number(m[6]), Number(m[4]) - 1, Number(m[5])))
  return Number.isNaN(d.getTime()) ? null : d
}
