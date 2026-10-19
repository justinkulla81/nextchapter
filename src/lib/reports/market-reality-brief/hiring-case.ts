// "Reasons an employer would hire you": the things employers pay for, each
// read against what NextChapter knows, and sorted into four honest states.
//
//   in place     — the record shows it
//   needs fixing — it exists, and there is an issue with it
//   not yet built — it does not exist for this member yet (no references, no
//                   AI skill, no outreach) — something to add
//   unknown      — we cannot tell, because the member has not given us the
//                   input (no assessment taken, no pay floor, no resume) —
//                   something to answer
//
// Every row names the NextChapter tool that adds or fixes it and links to it,
// so the table doubles as the member's build list. Pure rules over findings
// already computed in this report; no model call.

import type { ExperienceAnalysis } from './experience'
import type { AnswerField } from './answers'

export type HiringStatus = 'in_place' | 'issue' | 'missing' | 'unknown'

export const HIRING_STATUS_LABEL: Record<HiringStatus, string> = {
  in_place: 'In place',
  issue: 'Needs fixing',
  missing: 'Not yet built',
  unknown: 'We do not know yet',
}

export interface HiringReason {
  key: string
  /** Completes "Employers hire people who…". */
  reason: string
  status: HiringStatus
  /** What the record shows, in one sentence. */
  seen: string
  /** What to add, fix or answer in NextChapter — or, when in place, where to lead with it. */
  next: string
  tool: string
  href: string
  minutes: number | null
  /** When unknown or not built, a question the member can answer in place. */
  answer?: AnswerField
}

export interface HiringCaseInput {
  experience: ExperienceAnalysis
  dims: Partial<Record<string, number>> | null
  hasResume: boolean
  targetRole: string | null
  ai: { employersAsking: number; of: number; haveAny: boolean } | null
  completedReferences: number
  skillsAssessmentDone: boolean
  linkedInConfirmed: boolean
  dossier: { met: number; total: number } | null
  conversationsPerWeek: number | null
  payFloor: number | null
}

const ORDER: Record<HiringStatus, number> = { missing: 0, issue: 1, unknown: 2, in_place: 3 }

export function buildHiringCase(i: HiringCaseInput): HiringReason[] {
  const x = i.experience
  const dim = (k: string) => i.dims?.[k]
  const finding = (k: string) => x.findings.find((f) => f.key === k)
  const rows: HiringReason[] = []
  const add = (r: HiringReason) => rows.push(r)
  const NOT_READ = 'No resume on file, so this cannot be read yet.'

  // 1. Results with numbers
  {
    const q = dim('quantification')
    const base = { key: 'results', reason: 'Can prove their results with numbers', tool: 'Resume Fixer', href: '/dashboard/resume#resume-fixes', minutes: 45 }
    if (!i.hasResume || q === undefined) add({ ...base, status: 'unknown', seen: NOT_READ, next: 'Upload your resume. Quantified results are the first thing a hiring manager looks for.', href: '/dashboard/resume', minutes: 3 })
    else if (q >= 75) add({ ...base, status: 'in_place', seen: 'Outcomes carry numbers, so scope can be sized from the page.', next: 'Keep the strongest number in the first third of the resume.' })
    else add({ ...base, status: 'issue', seen: 'Most results are described, not sized. A reader assumes the smaller version.', next: 'Put a number beside your three biggest results (team, budget, revenue, time saved), then add one work sample that proves one.' })
  }

  // 2. Level
  {
    const f = finding('level_fit')
    const base = { key: 'level', reason: 'Have already operated at this level', tool: 'My Search Strategy', href: '/dashboard/search-strategy', minutes: 10 }
    if (!i.targetRole) add({ ...base, status: 'unknown', seen: 'No target role is set, so level cannot be compared.', next: 'Set your target role and level in Search Strategy.' })
    else if (!f) add({ ...base, status: 'unknown', seen: 'Not enough work history to compare against the target.', next: 'Add your work history to your profile.', tool: 'My Profile', href: '/dashboard/profile' })
    else if (f.assessment === 'development') add({ ...base, status: 'issue', seen: f.measure, next: 'Show next-level work: a P&L or budget owned, directors reporting in. Add a reference who will say so.', tool: 'My References', href: '/dashboard/references', minutes: 15 })
    else add({ ...base, status: 'in_place', seen: f.measure, next: 'Say so in the first line of every outreach message: it removes the “can they step up?” question.' })
  }

  // 3. Relevant, recent work
  {
    const r = dim('relevanceRecency')
    const base = { key: 'recency', reason: 'Have done this work recently', tool: 'My Profile', href: '/dashboard/profile', minutes: 10 }
    if (r === undefined) add({ ...base, status: 'unknown', seen: NOT_READ, next: 'Upload your resume.', href: '/dashboard/resume', minutes: 3 })
    else if (r >= 75) add({ ...base, status: 'in_place', seen: 'The work most like the target is recent.', next: 'Lead the summary with it.' })
    else add({ ...base, status: 'issue', seen: 'The work most like the target looks dated or is buried.', next: 'Move the most relevant recent role up, and add current interim, fractional or contract work to show it is live.', tool: 'Find Interim Work', href: '/dashboard/interim-work', minutes: 30 })
  }

  // 4. Stability and explained gaps
  {
    const t = finding('tenure')
    const g = finding('gaps')
    const base = { key: 'stability', reason: 'Stay and deliver', tool: 'My Profile', href: '#recruiter-read', minutes: 10 }
    if (!x.assessable) add({ ...base, status: 'unknown', seen: 'Two or more roles are needed to read tenure and gaps.', next: 'Add your work history.', href: '/dashboard/profile' })
    else if (t?.assessment === 'development' || g?.assessment === 'development' || x.openQuestions > 0)
      add({ ...base, status: 'issue', seen: [t?.assessment === 'development' ? t.measure : null, g?.assessment === 'development' ? g.measure : null].filter(Boolean).join(' ') || `${x.openQuestions} stability question${x.openQuestions === 1 ? '' : 's'} a reviewer will ask.`, next: 'Write a one-line reason for each short stint and gap. Unexplained is worse than any actual reason.' })
    else add({ ...base, status: 'in_place', seen: [t?.measure, g?.measure].filter(Boolean).join(' '), next: 'Lead with your longest, strongest tenure in interviews.' })
  }

  // 5. References
  {
    const n = i.completedReferences
    const base = { key: 'references', reason: 'Are vouched for by people who worked with them', tool: 'My References', href: '/dashboard/references', minutes: 15 }
    if (n >= 3) add({ ...base, status: 'in_place', seen: `${n} completed references.`, next: 'Offer them at the first interview, not the last.' })
    else if (n === 0) add({ ...base, status: 'missing', seen: 'No completed references.', next: 'Ask three people who saw your best work. Third-party proof is what turns claims into verified ones.' })
    else add({ ...base, status: 'issue', seen: `${n} of 3 references completed.`, next: `Ask ${3 - n} more, ideally one boss, one peer and one direct report.` })
  }

  // 6. Current skills
  {
    const s = dim('skillCurrency')
    const base = { key: 'skills', reason: 'Have skills that are current for the role', tool: 'Skills & Behavioral Assessments', href: '/dashboard/skills-assessment', minutes: 15 }
    if (!i.skillsAssessmentDone) add({ ...base, status: 'unknown', seen: 'The skills assessment has not been taken, so matches cannot read your skills.', next: 'Take it: it makes job matches, the skills gap and the learning plan specific to you.' })
    else if (s !== undefined && s < 50) add({ ...base, status: 'issue', seen: 'Tools and vocabulary on the page look dated for the role.', next: 'Name the current tools you use and close the biggest gap in Learn.', tool: 'Learn New Skills', href: '/dashboard/learning', minutes: null })
    else add({ ...base, status: 'in_place', seen: 'Skills are on file and read as current.', next: 'Keep them current as postings change.' })
  }

  // 7. AI
  {
    const a = i.ai
    const base = { key: 'ai', reason: 'Use AI in their work', tool: 'Learn New Skills', href: '/dashboard/learning#ai-skills-for-your-search', minutes: null }
    if (!a) add({ ...base, status: 'unknown', seen: 'Not enough matching jobs yet to read what employers ask for.', next: 'Finish your Search Strategy so we can match jobs.', tool: 'My Search Strategy', href: '/dashboard/search-strategy', minutes: 10 })
    else if (a.employersAsking > 0 && !a.haveAny) add({ ...base, status: 'missing', seen: `${a.employersAsking} of ${a.of} employers with jobs that fit you ask for AI skills. None is on your profile.`, next: 'If you use AI, add it to your skills with one example. If not, take the course tagged for the biggest gap.' })
    else if (a.haveAny) add({ ...base, status: 'in_place', seen: 'AI skills are on your profile.', next: 'Bring one concrete example with an outcome to interviews.' })
    else add({ ...base, status: 'in_place', seen: 'Employers with jobs that fit you do not yet ask for specific AI skills.', next: 'Track it: this changes quickly.' })
  }

  // 8. Target and story
  {
    const n = dim('narrativePositioning')
    const base = { key: 'positioning', reason: 'Have a clear target and a story', tool: 'Resume Fixer', href: '/dashboard/resume#resume-fixes', minutes: 20 }
    if (!i.targetRole) add({ ...base, status: 'unknown', seen: 'No target role is set.', next: 'Say what you want next in Search Strategy. Everything else is sized from it.', tool: 'My Search Strategy', href: '/dashboard/search-strategy', minutes: 10 })
    else if (n === undefined) add({ ...base, status: 'unknown', seen: NOT_READ, next: 'Upload your resume.', href: '/dashboard/resume', minutes: 3 })
    else if (n >= 75) add({ ...base, status: 'in_place', seen: 'The resume says what you want and what you are known for.', next: 'Reuse the same line in LinkedIn and every first message.' })
    else add({ ...base, status: 'issue', seen: 'The resume records what you have done but not what you want next. Reviewers will not guess.', next: 'Add one line under your name: role, level, industry, and the result you are known for.' })
  }

  // 9. Professional presence
  add(
    i.linkedInConfirmed
      ? { key: 'presence', reason: 'Look credible when they check', status: 'in_place', seen: 'LinkedIn is confirmed on your profile.', next: 'Match the headline to your positioning line.', tool: 'My Marketing Plan', href: '/dashboard/linkedin', minutes: 20 }
      : { key: 'presence', reason: 'Look credible when they check', status: 'unknown', seen: 'Your LinkedIn status is not confirmed, so we cannot tell what a recruiter finds.', next: 'Paste your LinkedIn address, then align the headline to your target.', tool: 'My Marketing Plan', href: '/dashboard/linkedin', minutes: 20, answer: 'linkedin_url' }
  )

  // 10. Access
  {
    const c = i.conversationsPerWeek
    const base = { key: 'access', reason: 'Come through someone the employer trusts', tool: 'Network with Contacts', href: '/dashboard/network', minutes: 30 }
    if (c === null) add({ ...base, status: 'unknown', seen: 'Not enough on file to estimate your search pace.', next: 'Finish your profile so the report can size the activity this market takes.', tool: 'My Profile', href: '/dashboard/profile', minutes: 10 })
    else if (c >= 3) add({ ...base, status: 'in_place', seen: `About ${Math.round(c * 10) / 10} conversations a week.`, next: 'Ask each for one introduction.' })
    else if (c > 0) add({ ...base, status: 'issue', seen: `About ${Math.round(c * 10) / 10} conversations a week. Most roles at this level are filled through introductions.`, next: 'Plan the weekly conversations in Network and log each one.' })
    else add({ ...base, status: 'missing', seen: 'No networking activity logged in the last four weeks.', next: 'Start with three former colleagues this week. Conversations convert several times better than applications.' })
  }

  // 11. Proof beyond the resume
  {
    const d = i.dossier
    const base = { key: 'proof', reason: 'Show proof beyond the resume', tool: 'My Portfolio', href: '/dashboard/portfolio', minutes: 30 }
    if (!d) add({ ...base, status: 'unknown', seen: 'We could not read your portfolio progress.', next: 'Open My Portfolio.' })
    else if (d.met === 0) add({ ...base, status: 'missing', seen: 'No portfolio steps are complete.', next: 'Build the Executive Dossier: references, work samples and assessments in one place an employer can open.' })
    else if (d.met / d.total >= 0.7) add({ ...base, status: 'in_place', seen: `${d.met} of ${d.total} portfolio steps complete.`, next: 'Share it with recruiters.' })
    else add({ ...base, status: 'issue', seen: `${d.met} of ${d.total} portfolio steps complete.`, next: 'Finish the next steps in your Portfolio; each one adds verified proof.' })
  }

  // 12. Pay
  add(
    i.payFloor
      ? { key: 'pay', reason: 'Ask for what the role pays', status: 'in_place', seen: `A pay floor of $${i.payFloor.toLocaleString('en-US')} is on file.`, next: 'Check it against advertised pay for your role.', tool: 'Know your worth', href: '/dashboard/pay', minutes: 10 }
      : { key: 'pay', reason: 'Ask for what the role pays', status: 'unknown', seen: 'No pay floor is set, so we cannot say how many roles clear it.', next: 'Pick your range, then compare it with the market.', tool: 'My Search Strategy', href: '/dashboard/search-strategy', minutes: 5, answer: 'pay_floor' }
  )

  // 13. Findability
  {
    const a = dim('atsLegibility')
    const c = dim('contactability')
    const low = Math.min(a ?? 100, c ?? 100)
    const base = { key: 'findable', reason: 'Are easy to find, read and reach', tool: 'Resume Fixer', href: '/dashboard/resume#resume-fixes', minutes: 20 }
    if (a === undefined && c === undefined) add({ ...base, status: 'unknown', seen: NOT_READ, next: 'Upload your resume to test how screening software reads it.', href: '/dashboard/resume', minutes: 3 })
    else if (low < 50) add({ ...base, status: 'issue', seen: 'Screening software or a recruiter may not be able to read or reach you.', next: 'Use a single column, standard headings and a plain contact line.' })
    else add({ ...base, status: 'in_place', seen: 'The file reads cleanly and you are easy to reach.', next: 'Send the .docx where a form asks for a file.' })
  }

  return rows.sort((a, b) => ORDER[a.status] - ORDER[b.status])
}

export function hiringCaseCounts(rows: HiringReason[]): Record<HiringStatus, number> {
  const c: Record<HiringStatus, number> = { in_place: 0, issue: 0, missing: 0, unknown: 0 }
  for (const r of rows) c[r.status]++
  return c
}
