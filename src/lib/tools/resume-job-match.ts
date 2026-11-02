// Résumé vs job description: which words the posting asks for that the résumé already says, and which it does not.
// Pure, no AI and no network, so the same two texts always give the same result, a check costs nothing, and the page
// can run it in the browser without sending either text anywhere. Tested in src/test/resume-job-match.test.ts.
//
// It compares wording. It cannot tell whether the experience behind a word is real or strong, and the page says so.

export const JOB_MIN_CHARS = 200
export const RESUME_MIN_CHARS = 300
export const TEXT_MAX_CHARS = 30_000
/** How many terms from the posting are compared. */
const MAX_TERMS = 30
const MIN_TERMS = 5

const STOP = new Set(
  ('a about above across after again against all also am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers him his how i if in into is it its just me more most my no nor not now of off on once only or other our out over own per same she should so some such than that the their them then there these they this those through to too under until up us very was we were what when where which while who whom why will with would you your yours' +
    ' ability able advanced accordance additional additionally across applicants apply applying aspects assist based basis benefits best candidate candidates carry certain closely come company completed comprehensive concerns considered consistent currently day days degree demonstrated demonstrates described desire desired detail details directly diverse duties effective effectively employer employees employment environment equal essential etc ensure ensuring excellent existing experience experienced familiar following full general good great handle help helps high highly ideal including include includes individual individuals information join knowledge largest level like limited looking maintain make makes many may meet member members must need needs new next number offer offers one opportunity opportunities options organization others overall own part participate people perform performing person plus position positions possess preferred previous primary proven provide provides providing qualifications qualified range related relevant required requirements requires responsibilities responsibility responsible results role roles search seeking senior set several similar skills solid some strong successful support supporting take tasks team teams therefore throughout time together tools typically understand understanding use used using various verbal via well within without work working works written year years' +
    ' monday tuesday wednesday thursday friday salary pay hour hourly annual annually bonus equity paid insurance vacation holidays dental medical vision')
    .split(/\s+/),
)

/** Terms worth more than their count suggests: tools, systems, methods and credentials a posting names on purpose. */
const SKILLS = new Set(
  ('excel sql python java javascript typescript react node aws azure gcp tableau powerbi looker salesforce hubspot netsuite sap oracle workday quickbooks jira confluence asana agile scrum kanban lean six sigma pmp cpa cfa sox gaap ifrs fp&a crm erp seo sem ppc analytics forecasting budgeting audit compliance negotiation procurement recruiting onboarding payroll hris benefits ux ui figma sketch photoshop illustrator adobe copywriting salesforce marketo mailchimp shopify api rest docker kubernetes terraform linux git ci/cd devops excel powerpoint tableau r sas spss matlab stata dbt snowflake bigquery redshift airflow spark hadoop kafka machine learning nlp llm cybersecurity soc2 hipaa gdpr fedramp iso cissp pmo okr kpi p&l ebitda').split(/\s+/),
)

/** A heading that starts the part of a posting that lists what is required. */
const REQUIRED_HEADING = /^(?:\W*)(requirements?|qualifications?|what you(?:'|’)?ll need|what we(?:'|’)?re looking for|must have|minimum qualifications|basic qualifications|you have|you bring|who you are|skills)\b/i
const PREFERRED_HEADING = /^(?:\W*)(preferred|nice to have|bonus|plus|desired)\b/i
const OTHER_HEADING = /^(?:\W*)(about|benefits|perks|compensation|responsibilities|what you(?:'|’)?ll do|the role|overview|our|why|equal|how to apply)\b/i

export interface MatchTerm {
  term: string
  /** Times the posting says it. */
  count: number
  /** It sits in the posting's requirements section. */
  required: boolean
  /** A tool, system, method or credential, not a general word. */
  skill: boolean
}

export interface JobMatchResult {
  /** Share of the posting's weighted terms the résumé already says, 0 to 100. */
  score: number
  band: 'strong' | 'good' | 'partial' | 'weak'
  bandLabel: string
  matched: MatchTerm[]
  missing: MatchTerm[]
  /** How many terms were compared. */
  compared: number
  /** The posting's likely job title (its first line) appears in the résumé. */
  titleInResume: boolean | null
  titleLine: string | null
  /** Plain next steps from this result. */
  tips: string[]
}

export const BAND_LABEL: Record<JobMatchResult['band'], string> = {
  strong: 'Strong match',
  good: 'Good match',
  partial: 'Partial match',
  weak: 'Weak match',
}

const bandFor = (score: number): JobMatchResult['band'] => (score >= 80 ? 'strong' : score >= 60 ? 'good' : score >= 40 ? 'partial' : 'weak')

/** Lowercase words, keeping the characters that make a skill's name (c++, c#, node.js, ci/cd, p&l). */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9+#./&\s-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^[-./&]+|[-./&]+$/g, ''))
    .filter(Boolean)
}

/** A light stem so "managed", "manages" and "managing" read as one word, without a dictionary. */
export function stem(w: string): string {
  if (w.length <= 3 || /[+#/&]/.test(w)) return w
  let s = w
  if (s.endsWith('ies') && s.length > 4) s = `${s.slice(0, -3)}y`
  else if (s.endsWith('ing') && s.length > 5) s = s.slice(0, -3)
  else if (s.endsWith('ed') && s.length > 4) s = s.slice(0, -2)
  else if (s.endsWith('es') && s.length > 4) s = s.slice(0, -2)
  else if (s.endsWith('s') && !s.endsWith('ss') && s.length > 3) s = s.slice(0, -1)
  if (s.length > 3 && s.endsWith('e')) s = s.slice(0, -1)
  return s
}

const isWord = (w: string) => w.length >= 2 && !STOP.has(w) && !/^\d+([.,]\d+)?$/.test(w) && /[a-z]/.test(w)

interface Raw { words: string[]; count: number; required: boolean; skill: boolean }

function sectionFlags(lines: string[]): boolean[] {
  // true for every line inside a requirements-type section; the section ends at the next heading.
  const out: boolean[] = []
  let inRequired = false
  for (const line of lines) {
    const t = line.trim()
    const short = t.length > 0 && t.length <= 60 && !/[.!?]$/.test(t)
    if (short && REQUIRED_HEADING.test(t) && !PREFERRED_HEADING.test(t)) inRequired = true
    else if (short && (PREFERRED_HEADING.test(t) || OTHER_HEADING.test(t))) inRequired = false
    out.push(inRequired)
  }
  return out
}

/** The terms a posting asks for, most important first: single words and two-word phrases, counted, with requirements and named skills ranked up. */
export function extractTerms(job: string): MatchTerm[] {
  const lines = job.split(/\r?\n/)
  const flags = sectionFlags(lines)
  const found = new Map<string, Raw>()
  const add = (words: string[], required: boolean) => {
    const key = words.map(stem).join(' ')
    const e = found.get(key) ?? { words, count: 0, required: false, skill: words.some((w) => SKILLS.has(w)) }
    e.count++
    if (required) e.required = true
    found.set(key, e)
  }
  lines.forEach((line, i) => {
    // A phrase never runs across a comma, semicolon, bracket or bullet: "excel and sql; tableau dashboards" has no "sql tableau".
    for (const clause of line.split(/[,;:()\u2022|]|\s[-\u2013\u2014]\s|\.\s/)) {
      const toks = tokenize(clause)
      for (let j = 0; j < toks.length; j++) {
        if (isWord(toks[j])) add([toks[j]], flags[i])
        // "advanced excel" says nothing "excel" does not; a phrase counts when it is two general words ("variance analysis") or two skills ("machine learning").
        if (j + 1 < toks.length && isWord(toks[j]) && isWord(toks[j + 1]) && SKILLS.has(toks[j]) === SKILLS.has(toks[j + 1])) add([toks[j], toks[j + 1]], flags[i])
      }
    }
  })
  const weight = (r: Raw) => r.count * (r.skill ? 2.5 : 1) * (r.required ? 1.6 : 1) * (r.words.length === 2 ? 1.4 : 1)
  const ranked = [...found.values()]
    // A word said once is noise unless it is a named skill or sits in the requirements; a phrase must be said twice or be a skill.
    .filter((r) => (r.words.length === 1 ? r.count >= 2 || r.skill || r.required : r.count >= 2 || (r.skill && r.required)))
    .sort((a, b) => weight(b) - weight(a) || b.count - a.count || a.words.join(' ').localeCompare(b.words.join(' ')))
  // For each general word, the most often a phrase that holds it is said: "financial" is left out when "financial reporting" carries it.
  const phraseCount = new Map<string, number>()
  for (const r of ranked) if (r.words.length === 2) for (const w of r.words.map(stem)) phraseCount.set(w, Math.max(phraseCount.get(w) ?? 0, r.count))
  const picked: Raw[] = []
  const covered = new Set<string>()
  for (const r of ranked) {
    if (picked.length >= MAX_TERMS) break
    const stems = r.words.map(stem)
    // A word already inside a chosen phrase adds nothing unless the posting also says it alone, often.
    if (r.words.length === 1 && covered.has(stems[0]) && r.count < 4) continue
    if (r.words.length === 1 && !r.skill && r.count < 6 && (phraseCount.get(stems[0]) ?? 0) >= r.count * 0.6) continue
    picked.push(r)
    for (const s of stems) covered.add(s)
  }
  return picked.map((r) => ({ term: r.words.join(' '), count: r.count, required: r.required, skill: r.skill }))
}

function resumeHas(resumeStems: string[], term: string): boolean {
  const need = tokenize(term).map(stem)
  if (need.length === 0) return false
  if (need.length === 1) return resumeStems.includes(need[0])
  for (let i = 0; i + need.length <= resumeStems.length; i++) if (need.every((n, k) => resumeStems[i + k] === n)) return true
  // Two-word phrases often sit apart in a résumé ("project ... management"); count the phrase when both words appear close together.
  const idx = need.map((n) => resumeStems.indexOf(n))
  return idx.every((x) => x >= 0) && Math.max(...idx) - Math.min(...idx) <= 6
}

function titleLineOf(job: string): string | null {
  const first = job.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0)
  if (!first || first.length > 80 || /[.!?]$/.test(first)) return null
  return first.replace(/\s*[-–|·(].*$/, '').trim() || null
}

export function matchResumeToJob(resume: string, job: string): JobMatchResult {
  const terms = extractTerms(job)
  const resumeStems = tokenize(resume).map(stem)
  const weight = (t: MatchTerm) => t.count * (t.skill ? 2.5 : 1) * (t.required ? 1.6 : 1)
  const matched: MatchTerm[] = []
  const missing: MatchTerm[] = []
  for (const t of terms) (resumeHas(resumeStems, t.term) ? matched : missing).push(t)
  const total = terms.reduce((s, t) => s + weight(t), 0)
  const got = matched.reduce((s, t) => s + weight(t), 0)
  const score = total === 0 ? 0 : Math.round((got / total) * 100)
  const titleLine = titleLineOf(job)
  const titleInResume = titleLine ? resumeHas(resumeStems, titleLine) || resume.toLowerCase().includes(titleLine.toLowerCase()) : null

  const tips: string[] = []
  const missingSkills = [...missing].filter((t) => t.skill || t.required).sort((a, b) => Number(b.skill) - Number(a.skill)).slice(0, 5)
  if (missingSkills.length) tips.push(`Add ${missingSkills.map((t) => `"${t.term}"`).join(', ')} where you have really used ${missingSkills.length === 1 ? 'it' : 'them'}. Put each in a bullet that shows the result, not only in a skills list.`)
  if (titleInResume === false && titleLine) tips.push(`The posting's title is "${titleLine}". If your recent title is close to it, say so in your headline or summary.`)
  if (missing.length > 0 && missingSkills.length === 0) tips.push('The missing words are general ones. Work them in only where they describe what you did.')
  if (terms.length < MIN_TERMS) tips.push('The posting gave few clear terms to compare. Paste the whole posting, including its requirements section, for a fuller read.')
  if (score >= 80) tips.push('Your wording already covers most of what this posting stresses. Check that the bullets behind those words show results with numbers.')
  return { score, band: bandFor(score), bandLabel: BAND_LABEL[bandFor(score)], matched, missing, compared: terms.length, titleInResume, titleLine, tips }
}

/** Why the pair cannot be compared yet, or null when it can. */
export function jobMatchInputError(resume: string, job: string): string | null {
  if (job.trim().length < JOB_MIN_CHARS) return `Paste the whole job posting (at least ${JOB_MIN_CHARS} characters) so there is enough to compare.`
  if (resume.trim().length < RESUME_MIN_CHARS) return `Paste your whole résumé as text (at least ${RESUME_MIN_CHARS} characters).`
  if (job.length > TEXT_MAX_CHARS || resume.length > TEXT_MAX_CHARS) return `Each text can be up to ${TEXT_MAX_CHARS.toLocaleString('en-US')} characters. Trim the longer one and try again.`
  return null
}
