// The résumé check: a fixed set of rules read over pasted résumé text. Pure, no AI and no network, so the same text
// always gets the same score and a check costs nothing. Tested in src/test/resume-check.test.ts.
//
// It checks structure and wording (contact details, headings, results with numbers, weak phrases, layout). It cannot
// judge whether your experience suits a role, and it says so on the page.

export const RESUME_MIN_CHARS = 400
export const RESUME_MAX_CHARS = 20_000

export type CheckStatus = 'pass' | 'partial' | 'fail'
export type ResumeBand = 'strong' | 'solid' | 'needs_work' | 'rework'

export interface ResumeFinding {
  id: string
  label: string
  status: CheckStatus
  /** Points this check is worth, and how many the résumé earned. The checks add up to 100. */
  points: number
  earned: number
  /** What the rules saw in this résumé. */
  detail: string
  /** What to change. */
  fix: string
}

export interface ResumeCheckResult {
  score: number
  band: ResumeBand
  bandLabel: string
  wordCount: number
  /** Every check, the ones that lost the most points first. */
  findings: ResumeFinding[]
  /** Checks that lost points. */
  issueCount: number
}

export const BAND_LABEL: Record<ResumeBand, string> = {
  strong: 'Strong',
  solid: 'Solid',
  needs_work: 'Needs work',
  rework: 'Needs a rework',
}

export function bandFor(score: number): ResumeBand {
  return score >= 80 ? 'strong' : score >= 65 ? 'solid' : score >= 45 ? 'needs_work' : 'rework'
}

const BULLET = /^\s*[-•*▪●◦–·‣]\s*/
const EMAIL = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i
const PHONE = /(?:\+?\d{1,2}[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}/
const NUMBER = /\d|%|\$/
const DATE_RANGE = /\b(?:19|20)\d{2}\s*(?:-|–|—|to)\s*(?:(?:19|20)\d{2}|present|current|now)\b/gi

const WEAK_PHRASES = [
  'responsible for',
  'duties included',
  'duties include',
  'worked on',
  'helped with',
  'helped to',
  'assisted with',
  'assisted in',
  'tasked with',
  'participated in',
  'in charge of',
  'involved in',
]

const CLICHES = [
  'team player',
  'hard worker',
  'hard-working',
  'detail-oriented',
  'detail oriented',
  'results-driven',
  'results driven',
  'go-getter',
  'self-motivated',
  'think outside the box',
  'synergy',
  'references available upon request',
  'strong communication skills',
  'dynamic professional',
]

const STRONG_VERBS = new Set(
  (
    'led managed built launched created designed developed delivered drove grew increased reduced cut saved improved ' +
    'negotiated closed won owned ran directed established implemented introduced streamlined automated analyzed ' +
    'architected shipped scaled hired trained mentored coached coordinated planned executed secured generated ' +
    'redesigned rebuilt transformed consolidated resolved partnered presented authored published won earned ' +
    'expanded spearheaded oversaw produced optimized migrated modernized reorganized'
  ).split(' '),
)

const WEAK_OPENERS = new Set(['responsible', 'duties', 'tasked', 'helped', 'worked', 'assisted', 'involved', 'participated', 'handled'])

function words(s: string): string[] {
  return s.toLowerCase().match(/[a-z][a-z'’-]*/g) ?? []
}

function has(text: string, re: RegExp): boolean {
  return re.test(text)
}

/** The lines that describe what someone did: explicit bullets when there are enough, else sentence-length lines. */
function descriptionLines(lines: string[]): string[] {
  const bullets = lines.filter((l) => BULLET.test(l)).map((l) => l.replace(BULLET, '').trim()).filter((l) => l.length > 15)
  if (bullets.length >= 4) return bullets
  return lines
    .map((l) => l.trim())
    .filter((l) => l.length >= 40 && l.length <= 300 && /^[A-Z]/.test(l) && !EMAIL.test(l) && !/^[A-Z0-9\s&/,.-]+$/.test(l))
}

function finding(f: Omit<ResumeFinding, 'status'> & { status?: CheckStatus }): ResumeFinding {
  const status = f.status ?? (f.earned >= f.points ? 'pass' : f.earned > 0 ? 'partial' : 'fail')
  return { ...f, status }
}

/** Reads pasted résumé text. Null when there is too little (or too much) to judge. */
export function analyzeResume(raw: string): ResumeCheckResult | null {
  const text = raw.replace(/\r\n?/g, '\n').trim()
  if (text.length < RESUME_MIN_CHARS || text.length > RESUME_MAX_CHARS) return null
  const lower = text.toLowerCase()
  const lines = text.split('\n')
  const wc = words(text).length
  const desc = descriptionLines(lines)
  const out: ResumeFinding[] = []

  // 1. Contact details (10)
  const hasEmail = EMAIL.test(text)
  const hasPhone = PHONE.test(text)
  out.push(
    finding({
      id: 'contact',
      label: 'Contact details',
      points: 10,
      earned: (hasEmail ? 5 : 0) + (hasPhone ? 5 : 0),
      detail: hasEmail && hasPhone ? 'An email address and a phone number are both there.' : `Missing: ${[!hasEmail && 'an email address', !hasPhone && 'a phone number'].filter(Boolean).join(' and ')}.`,
      fix: 'Put your email, phone number and city at the top of page one, as plain text, not inside a header or an image.',
    }),
  )

  // 2. Length (10)
  const lengthOk = wc >= 350 && wc <= 1000
  const lengthNear = (wc >= 250 && wc < 350) || (wc > 1000 && wc <= 1300)
  out.push(
    finding({
      id: 'length',
      label: 'Length',
      points: 10,
      earned: lengthOk ? 10 : lengthNear ? 5 : 0,
      detail: `${wc.toLocaleString('en-US')} words. Most résumés for experienced professionals run 350 to 1,000.`,
      fix: wc < 350 ? 'Add the results behind each role. Short usually means duties without outcomes.' : 'Cut roles older than 10 to 15 years to a line each and trim duties every person in the role shares. Keep it to two pages.',
    }),
  )

  // 3. Standard headings (15)
  const headings: [string, RegExp][] = [
    ['Experience', /^\s*(?:professional\s+|work\s+|relevant\s+)?(?:experience|employment(?: history)?|work history|career history)\s*:?\s*$/im],
    ['Education', /^\s*education(?:\s+(?:and|&)\s+\w+)?\s*:?\s*$/im],
    ['Skills', /^\s*(?:(?:core|key|technical)\s+)?(?:skills|competencies|expertise)(?:\s+(?:and|&)\s+\w+)?\s*:?\s*$/im],
  ]
  const missing = headings.filter(([, re]) => !has(text, re)).map(([n]) => n)
  out.push(
    finding({
      id: 'headings',
      label: 'Standard section headings',
      points: 15,
      earned: (3 - missing.length) * 5,
      detail: missing.length === 0 ? 'Experience, Education and Skills each have their own heading.' : `No clear heading for: ${missing.join(', ')}.`,
      fix: 'Use the plain headings applicant tracking systems look for (Experience, Education, Skills) on their own lines. Clever names like "My Journey" can hide a section from the screen.',
    }),
  )

  // 4. Results with numbers (20)
  const withNumbers = desc.filter((l) => NUMBER.test(l)).length
  const share = desc.length > 0 ? withNumbers / desc.length : 0
  out.push(
    finding({
      id: 'numbers',
      label: 'Results with numbers',
      points: 20,
      earned: share >= 0.35 ? 20 : share >= 0.2 ? 12 : share >= 0.1 ? 6 : 0,
      detail: desc.length === 0 ? 'No bullet or sentence lines to read for results.' : `${withNumbers} of ${desc.length} lines (${Math.round(share * 100)}%) contain a number, percent or dollar figure. A third or more is a good mark.`,
      fix: 'For each role, say what changed because of your work: revenue, cost, time saved, team size, customers, a percent. If you do not have an exact figure, use a fair estimate and say "about".',
    }),
  )

  // 5. Strong opening verbs (10)
  const openers = desc.map((l) => words(l)[0] ?? '').filter(Boolean)
  const strong = openers.filter((w) => STRONG_VERBS.has(w) || (w.endsWith('ed') && !WEAK_OPENERS.has(w))).length
  const strongShare = openers.length > 0 ? strong / openers.length : 0
  out.push(
    finding({
      id: 'verbs',
      label: 'Lines that start with what you did',
      points: 10,
      earned: strongShare >= 0.6 ? 10 : strongShare >= 0.35 ? 6 : strongShare >= 0.15 ? 3 : 0,
      detail: openers.length === 0 ? 'No lines to read.' : `${strong} of ${openers.length} lines start with an action word like "led", "built" or "reduced".`,
      fix: 'Start each bullet with a past-tense verb that says what you did ("Led", "Cut", "Launched"), then the result.',
    }),
  )

  // 6. Weak phrases (10)
  const weakHits = WEAK_PHRASES.reduce((n, p) => n + (lower.split(p).length - 1), 0)
  out.push(
    finding({
      id: 'weak',
      label: 'Duty phrases',
      points: 10,
      earned: weakHits === 0 ? 10 : weakHits <= 2 ? 6 : weakHits <= 5 ? 3 : 0,
      detail: weakHits === 0 ? 'No "responsible for" or "worked on" style phrases.' : `${weakHits} duty phrase${weakHits === 1 ? '' : 's'} like "responsible for" or "worked on".`,
      fix: 'Replace "responsible for X" with what you did to X and what came of it. Duties describe the job. Results describe you.',
    }),
  )

  // 7. Summary near the top (5)
  const hasSummary = has(text, /^\s*(?:professional\s+)?(?:summary|profile|about(?: me)?|executive summary|headline)\s*:?\s*$/im)
  const hasObjective = has(text, /^\s*(?:career\s+)?objective\s*:?\s*$/im)
  out.push(
    finding({
      id: 'summary',
      label: 'A summary at the top',
      points: 5,
      earned: hasSummary ? 5 : hasObjective ? 2 : 0,
      detail: hasSummary ? 'There is a summary or profile section.' : hasObjective ? 'There is an "Objective", which reads as dated.' : 'No summary or profile section.',
      fix: 'Open with two or three lines that name the role you want and your two strongest results. Replace an "Objective" with this.',
    }),
  )

  // 8. Clichés (5)
  const clicheHits = CLICHES.filter((c) => lower.includes(c))
  out.push(
    finding({
      id: 'cliches',
      label: 'Filler phrases',
      points: 5,
      earned: clicheHits.length === 0 ? 5 : clicheHits.length <= 2 ? 3 : 0,
      detail: clicheHits.length === 0 ? 'No stock phrases.' : `Stock phrases found: ${clicheHits.map((c) => `"${c}"`).join(', ')}.`,
      fix: 'Cut phrases anyone could write. Show the trait with a result instead of naming it. "References available upon request" can go.',
    }),
  )

  // 9. First person (5)
  const firstPerson = lines.filter((l) => /^\s*(?:[-•*▪●◦–·‣]\s*)?(?:i|i'm|i’m|my)\s/i.test(l)).length
  out.push(
    finding({
      id: 'pronouns',
      label: 'No "I" or "my" at the start of lines',
      points: 5,
      earned: firstPerson === 0 ? 5 : firstPerson <= 2 ? 3 : 0,
      detail: firstPerson === 0 ? 'No lines start with "I" or "my".' : `${firstPerson} line${firstPerson === 1 ? '' : 's'} start with "I" or "my".`,
      fix: 'Drop the pronoun and start with the verb. "Led a team of 12" reads cleaner than "I led my team of 12".',
    }),
  )

  // 10. Dates (5)
  const dateRanges = (text.match(DATE_RANGE) ?? []).length
  out.push(
    finding({
      id: 'dates',
      label: 'Dates on each role',
      points: 5,
      earned: dateRanges >= 2 ? 5 : dateRanges === 1 ? 3 : 0,
      detail: dateRanges === 0 ? 'No year ranges like "2019 – 2023" found.' : `${dateRanges} year range${dateRanges === 1 ? '' : 's'} found.`,
      fix: 'Give every role a start and end year in one consistent format, like "2019 – 2023" or "2021 – Present". Recruiters look for gaps and ordering first.',
    }),
  )

  // 11. Layout that survives pasting (5)
  const columns = lines.filter((l) => l.includes('\t') || (l.match(/\|/g) ?? []).length >= 2).length
  const walls = lines.filter((l) => l.length > 600).length
  out.push(
    finding({
      id: 'layout',
      label: 'Layout a screening system can read',
      points: 5,
      earned: columns === 0 && walls === 0 ? 5 : columns <= 2 && walls <= 1 ? 2 : 0,
      detail: columns === 0 && walls === 0 ? 'No tab columns, pipe tables or walls of text.' : `${columns} line${columns === 1 ? '' : 's'} with tab or pipe columns and ${walls} very long block${walls === 1 ? '' : 's'}.`,
      fix: 'Use one column, real bullets and short lines. Tables, text boxes and side columns often scramble when a screening system reads the file.',
    }),
  )

  const score = out.reduce((n, f) => n + f.earned, 0)
  const band = bandFor(score)
  const findings = [...out].sort((a, b) => b.points - b.earned - (a.points - a.earned))
  return { score, band, bandLabel: BAND_LABEL[band], wordCount: wc, findings, issueCount: out.filter((f) => f.earned < f.points).length }
}

/** What the visitor sees before giving an email: the score and the count, plus the name of the biggest problem, no fixes. */
export interface ResumeTeaser {
  score: number
  band: ResumeBand
  bandLabel: string
  wordCount: number
  issueCount: number
  checkCount: number
  topIssue: string | null
}

export function teaserFor(r: ResumeCheckResult): ResumeTeaser {
  const top = r.findings.find((f) => f.earned < f.points)
  return { score: r.score, band: r.band, bandLabel: r.bandLabel, wordCount: r.wordCount, issueCount: r.issueCount, checkCount: r.findings.length, topIssue: top ? top.label : null }
}
