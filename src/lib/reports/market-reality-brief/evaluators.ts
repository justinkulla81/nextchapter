// How the people who screen a candidate would read this one, and the
// objections that read produces. Pure rules over the findings already
// computed elsewhere in the report (experience.ts, the resume analysis
// scores, the skills gap) — no model call, so a line here can never claim
// something the data below it does not show.
//
// Three readers, each judging a different thing:
//   Recruiter            — a 30-second screen: does this resume earn a call?
//   Hiring manager       — can this person do my job, and how do I know?
//   Executive recruiter  — can I put my name in front of a client with this?
//
// Wording rules (Report Structure Spec §5.3, §7): the read is of the page
// and the record, never of the person; no consolation framing; a stance is
// "likely first read", not a prediction of any decision.

import type { ExperienceAnalysis, ExperienceFinding } from './experience'
import type { Assessment } from './types'

export type Stance = 'advance' | 'reservations' | 'pause'

export const STANCE_LABEL: Record<Stance, string> = {
  advance: 'Likely to advance',
  reservations: 'Advance with reservations',
  pause: 'Likely to pause',
}

/** Marks reuse the assessment glyphs: advance is full, reservations half, pause empty. */
export const STANCE_MARK: Record<Stance, Assessment> = {
  advance: 'strength',
  reservations: 'adequate',
  pause: 'development',
}

export type FirstGlance = 'PASS' | 'BORDERLINE' | 'LIKELY_SKIP'

export interface EvaluatorInput {
  targetRole: string | null
  experience: ExperienceAnalysis
  firstGlance: FirstGlance | null
  firstGlanceTopFix: string | null
  /** Resume-analysis dimension scores, 0-100, keyed by dimension. */
  dims: Partial<Record<string, number>> | null
  /** What employers with fitting jobs ask for in AI, against what the profile shows. */
  ai: { employersAsking: number; of: number; haveAny: boolean } | null
  conversationsPerWeek: number | null
  marketPrompt: 'too_many' | 'too_few' | 'shrinking' | 'healthy' | null
  payFloor: number | null
}

export interface EvaluatorView {
  key: 'recruiter' | 'hiring_manager' | 'executive_recruiter'
  who: string
  /** What this reader is judging. */
  lens: string
  stance: Stance
  /** What is on the page in the first seconds. */
  firstImpression: string
  /** The reader's thinking, in their own voice. */
  thinking: string[]
  /** What they will put to the candidate. */
  questions: string[]
  /** What would move the stance one step up. */
  changesMind: string[]
}

export interface Objection {
  key: string
  question: string
  answer: string
  source: 'Experience' | 'Resume' | 'Skills'
  /** 1 (be ready) to 3 (will decide the screen). Ordering only. */
  severity: 1 | 2 | 3
}

const money = (n: number) => `$${n.toLocaleString('en-US')}`

function months(m: number): string {
  if (m < 12) return `${m} month${m === 1 ? '' : 's'}`
  const y = m / 12
  return `${y >= 10 ? Math.round(y) : Math.round(y * 10) / 10} years`
}

function findingOf(x: ExperienceAnalysis, key: string): ExperienceFinding | undefined {
  return x.findings.find((f) => f.key === key)
}
const isDev = (x: ExperienceAnalysis, key: string) => findingOf(x, key)?.assessment === 'development'

const step = (n: number): Stance => (n <= 0 ? 'advance' : n === 1 ? 'reservations' : 'pause')
const objectionsFor = (x: ExperienceAnalysis, keys: string[]) =>
  keys.map((k) => findingOf(x, k)?.objection).filter((q): q is string => !!q)

export function buildEvaluatorViews(i: EvaluatorInput): EvaluatorView[] {
  const x = i.experience
  const d = (k: string) => i.dims?.[k]
  const target = i.targetRole ?? 'the target role'
  const latest = x.facts.latest
  const noNumbers = (d('quantification') ?? 100) < 50
  const noTarget = (d('narrativePositioning') ?? 100) < 50
  const aiGap = i.ai && i.ai.employersAsking > 0 && !i.ai.haveAny

  // ── Recruiter ─────────────────────────────────────────────────────────
  const recruiterLoad =
    (i.firstGlance === 'LIKELY_SKIP' ? 2 : i.firstGlance === 'BORDERLINE' || i.firstGlance === null ? 1 : 0) +
    (isDev(x, 'tenure') ? 1 : 0) +
    (isDev(x, 'gaps') ? 1 : 0)
  const recruiterThinking: string[] = []
  if (i.firstGlance === 'PASS') recruiterThinking.push('The strongest evidence is near the top. I can place this person in a minute.')
  else if (i.firstGlance === 'BORDERLINE') recruiterThinking.push('I can see experience but not the headline result or what they want next. This is a maybe, and maybes wait.')
  else if (i.firstGlance === 'LIKELY_SKIP') recruiterThinking.push('Nothing in the top third tells me why to keep reading. At this volume, that is where I stop.')
  else recruiterThinking.push('I have no first-screen read to go on yet. Upload a resume to see how it opens.')
  if (isDev(x, 'tenure')) recruiterThinking.push('Several short stints. I need a reason before I put this in front of a manager.')
  else if (findingOf(x, 'tenure')?.assessment === 'strength') recruiterThinking.push('Tenures are stable, so there is nothing to explain away.')
  if (isDev(x, 'gaps')) recruiterThinking.push('There is a stretch I cannot account for. I will ask before submitting.')
  if (noTarget) recruiterThinking.push(`I cannot tell whether this person wants ${target}. I will not guess on their behalf.`)

  const recruiter: EvaluatorView = {
    key: 'recruiter',
    who: 'Recruiter',
    lens: 'A screen of about thirty seconds per resume. The only question is whether this earns a call.',
    stance: step(recruiterLoad),
    firstImpression: latest
      ? `${latest.title}, ${latest.company}${latest.current ? '' : ' (most recent)'}, ${months(latest.months)}.${x.facts.priorEmployers.length > 0 ? ` Before that: ${x.facts.priorEmployers.join(', ')}.` : ''}`
      : 'No work history on file to read.',
    thinking: recruiterThinking.slice(0, 3),
    questions: [
      'What are you looking for, and why now?',
      ...objectionsFor(x, ['tenure', 'gaps']),
      ...(i.payFloor ? [`Your range: is ${money(i.payFloor)} firm?`] : []),
    ],
    changesMind: [
      ...(i.firstGlanceTopFix ? [i.firstGlanceTopFix] : []),
      ...(isDev(x, 'tenure') || isDev(x, 'gaps') ? ['A one-line reason beside each short stint and gap.'] : []),
    ],
  }

  // ── Hiring manager ────────────────────────────────────────────────────
  const hmDims = ['quantification', 'scopeLevel', 'relevanceRecency', 'skillCurrency'].map(d).filter((v): v is number => typeof v === 'number')
  const hmAvg = hmDims.length > 0 ? hmDims.reduce((s, v) => s + v, 0) / hmDims.length : null
  let hmStance: Stance = hmAvg === null ? 'reservations' : hmAvg >= 70 ? 'advance' : hmAvg >= 45 ? 'reservations' : 'pause'
  if (isDev(x, 'level_fit') && hmStance === 'advance') hmStance = 'reservations'
  const hmThinking: string[] = []
  if (noNumbers) hmThinking.push('I cannot size what this person ran. Without numbers I assume the smaller version.')
  else if (d('quantification') !== undefined) hmThinking.push('The results are quantified, so I can size the role and compare it with mine.')
  if (x.facts.teamSizeMax) hmThinking.push(`The largest team on file is ${x.facts.teamSizeMax.toLocaleString()}. I will test whether that was direct or dotted-line.`)
  if ((d('relevanceRecency') ?? 100) < 60) hmThinking.push('The most relevant work looks dated. I need to see it done recently.')
  if (isDev(x, 'level_fit')) hmThinking.push(`This person has not held the level of ${target}. I need proof they already do that work.`)
  if (aiGap) hmThinking.push('Nothing shows current-tool use. I will ask how they use AI in their own work.')
  if (noTarget) hmThinking.push('No stated target. I do not know whether this is the role they want from me.')

  const hiringManager: EvaluatorView = {
    key: 'hiring_manager',
    who: 'Hiring manager',
    lens: 'Whether this person can do the job, judged on evidence of scope, results and judgment.',
    stance: hmStance,
    firstImpression: noNumbers
      ? 'Responsibilities are described; the size of the results is not. Scope has to be inferred from titles.'
      : 'Results carry numbers, so scope can be read from the page.',
    thinking: hmThinking.slice(0, 3),
    questions: [
      'Walk me through the largest result you owned and how it was measured.',
      ...objectionsFor(x, ['level_fit', 'progression']),
      ...(aiGap ? ['How do you use AI in your work today?'] : []),
    ],
    changesMind: [
      ...(noNumbers ? ['A number beside the three biggest results: team size, budget, revenue or time saved.'] : []),
      ...(isDev(x, 'level_fit') ? ['Evidence of next-level work: a P&L or budget owned, directors reporting in, board exposure.'] : []),
      ...(aiGap ? ['One concrete example of AI used in the work, with the outcome.'] : []),
    ],
  }

  // ── Executive recruiter ───────────────────────────────────────────────
  const partnerLoad = ['tenure', 'gaps', 'progression', 'level_fit', 'industry', 'plateau'].filter((k) => isDev(x, k)).length + (noTarget ? 1 : 0)
  const partnerThinking: string[] = ['Can I explain this person to a client in two sentences, and will those two sentences hold up?']
  const prog = findingOf(x, 'progression')
  if (prog) partnerThinking.push(`Trajectory: ${prog.measure.replace(/\.$/, '')}.`)
  if (isDev(x, 'tenure') || isDev(x, 'gaps')) partnerThinking.push('The stability questions are mine to answer before the client asks them. I need the real reason, in a sentence.')
  if (isDev(x, 'industry')) partnerThinking.push('Several industries. A client will want the through-line before they want the résumé.')
  if (i.conversationsPerWeek !== null && i.conversationsPerWeek < 1) partnerThinking.push('There is no visible network behind this candidacy. The searches I run are won through people who vouch.')
  if (i.marketPrompt === 'too_few' || i.marketPrompt === 'shrinking') partnerThinking.push('Few roles exist at this level and fewer are posted. Most are filled by introduction.')

  const executiveRecruiter: EvaluatorView = {
    key: 'executive_recruiter',
    who: 'Executive recruiter',
    lens: 'Whether to put their own name in front of a client: placement risk, story and trajectory.',
    stance: step(partnerLoad),
    firstImpression: latest
      ? `${x.careerYears ?? 'Multiple'} years, ${x.roleCount} roles at ${x.employerCount} employer${x.employerCount === 1 ? '' : 's'}${x.facts.longest ? `; longest tenure ${months(x.facts.longest.months)} at ${x.facts.longest.company}` : ''}.`
      : 'No work history on file to read.',
    thinking: partnerThinking.slice(0, 5),
    questions: [
      ...objectionsFor(x, ['progression', 'plateau', 'level_fit', 'industry']),
      'Where else are you in process, and what are you weighing?',
      ...(i.payFloor ? [`What would it take to move you, and is ${money(i.payFloor)} the floor?`] : []),
    ],
    changesMind: [
      ...(noTarget ? ['A two-line positioning statement: the role, the level, and the result you are known for.'] : []),
      ...(isDev(x, 'tenure') || isDev(x, 'gaps') ? ['A prepared one-sentence reason for each stability question.'] : []),
      ...(i.conversationsPerWeek !== null && i.conversationsPerWeek < 1 ? ['An introduction from someone who has worked with you.'] : []),
    ],
  }

  return [recruiter, hiringManager, executiveRecruiter]
}

// ── Objections ─────────────────────────────────────────────────────────────

export function buildObjections(i: Pick<EvaluatorInput, 'experience' | 'dims' | 'ai' | 'targetRole'>): Objection[] {
  const out: Objection[] = []
  for (const f of i.experience.findings) {
    if (!f.objection || !f.answer || f.assessment === 'strength') continue
    out.push({ key: f.key, question: f.objection, answer: f.answer, source: 'Experience', severity: f.assessment === 'development' ? 3 : 2 })
  }
  const q = i.dims?.quantification
  if (q !== undefined && q < 50) {
    out.push({
      key: 'quantification',
      question: 'How big was what you ran? I cannot tell from the page.',
      answer: 'Open with the size: team, budget, revenue, geography. Then the result and how it was measured. Say the number before the story.',
      source: 'Resume',
      severity: 3,
    })
  }
  const n = i.dims?.narrativePositioning
  if (n !== undefined && n < 50) {
    out.push({
      key: 'positioning',
      question: `What role are you actually after${i.targetRole ? `: ${i.targetRole}, or something adjacent` : ''}?`,
      answer: 'Lead with one line: the role, the level, the industry or company size, and the result you are known for. Repeat it in the resume, the LinkedIn headline and every first message.',
      source: 'Resume',
      severity: 3,
    })
  }
  if (i.ai && i.ai.employersAsking > 0 && !i.ai.haveAny) {
    out.push({
      key: 'ai',
      question: 'How do you use AI in your work today?',
      answer: 'Give one specific use, what it replaced or sped up, and the result. If you have none yet, name the first workflow you would apply it to in this role and the measure you would track.',
      source: 'Skills',
      severity: 2,
    })
  }
  return out.sort((a, b) => b.severity - a.severity)
}
