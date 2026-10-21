// "The case for you": what a buyer would pay for, taken from the record.
// Pure rules over the same findings the rest of the report reads. Every item
// cites the evidence it rests on and says where to lead with it, so the
// section is a set of things to use, not praise. When the record does not
// yet carry a lead differentiator the section says so and points at the
// work that builds one — it never invents a strength (Report Structure Spec
// §3.2: "Generic praise is worse than no praise").

import type { ExperienceAnalysis } from './experience'

export interface CaseItem {
  key: string
  headline: string
  evidence: string
  /** Where to use it. */
  leadWith: string
  /** Ordering only. */
  weight: number
}

export interface CaseInput {
  experience: ExperienceAnalysis
  dims: Partial<Record<string, number>> | null
  ai: { employersAsking: number; of: number; haveAny: boolean } | null
  conversationsPerWeek: number | null
  /** Strengths already extracted from the candidate's own documents, each citing something specific. */
  documentStrengths: { title: string; detail: string }[]
  targetRole: string | null
  function: string | null
  yearsExperience: number | null
}

export interface CaseForYou {
  items: CaseItem[]
  /** A draft one-line positioning statement, built only from facts on file. Null when too little is known. */
  positioningLine: string | null
}

const years = (months: number) => `${Math.round((months / 12) * 10) / 10} years`

export function buildCaseForYou(i: CaseInput): CaseForYou {
  const x = i.experience
  const items: CaseItem[] = []
  const dim = (k: string) => i.dims?.[k]
  const finding = (k: string) => x.findings.find((f) => f.key === k)

  if (x.facts.longest && x.facts.longest.months >= 48 && finding('tenure')?.assessment !== 'development') {
    items.push({
      key: 'stability',
      headline: 'Proven staying power',
      evidence: `${years(x.facts.longest.months)} at ${x.facts.longest.company}${finding('tenure')?.assessment === 'strength' ? ', and no unexplained short stints in the last ten years' : ''}.`,
      leadWith: 'Interview and executive-recruiter conversations, where stability is the first doubt to clear.',
      weight: 70,
    })
  }
  if (x.facts.teamSizeMax && x.facts.teamSizeMax >= 10) {
    items.push({
      key: 'scale',
      headline: 'Scale of leadership',
      evidence: `Led a team of up to ${x.facts.teamSizeMax.toLocaleString()}.`,
      leadWith: 'The first line of the resume summary and every first message to a hiring manager.',
      weight: 80,
    })
  }
  const prog = finding('progression')
  if (prog && prog.assessment === 'strength') {
    items.push({ key: 'trajectory', headline: 'A steady climb', evidence: prog.measure, leadWith: 'The summary and the executive-recruiter pitch: it answers “is this person still growing?”.', weight: 65 })
  }
  const lvl = finding('level_fit')
  if (lvl && lvl.assessment === 'strength') {
    items.push({ key: 'level', headline: 'Already operating at the target level', evidence: lvl.measure, leadWith: 'Outreach: it removes the “can they step up?” question before it is asked.', weight: 75 })
  }
  if ((dim('quantification') ?? 0) >= 75) {
    items.push({ key: 'numbers', headline: 'Results that can be sized', evidence: 'The resume states outcomes with numbers, so a hiring manager can compare scope without guessing.', leadWith: 'Keep the strongest number in the first third of the page; it is what the first screen reads.', weight: 85 })
  }
  if ((dim('narrativePositioning') ?? 0) >= 75) {
    items.push({ key: 'story', headline: 'A clear target and story', evidence: 'The resume says what you want next, which is rare and the reason recruiters can place you quickly.', leadWith: 'Reuse the same line in the LinkedIn headline and every outreach message.', weight: 60 })
  }
  if (i.ai?.haveAny && i.ai.employersAsking > 0) {
    items.push({ key: 'ai', headline: 'Current-tool fluency', evidence: `AI skills are on your profile, and ${i.ai.employersAsking} of the ${i.ai.of} employers with jobs that fit you ask for them.`, leadWith: 'One concrete example with an outcome, in the summary and in interviews.', weight: 55 })
  }
  if (i.conversationsPerWeek !== null && i.conversationsPerWeek >= 3) {
    items.push({ key: 'network', headline: 'An active network', evidence: `About ${Math.round(i.conversationsPerWeek * 10) / 10} real conversations a week over the last month.`, leadWith: 'Ask for introductions: warm paths are how most roles at this level are filled.', weight: 72 })
  }
  for (const [n, s] of i.documentStrengths.slice(0, 2).entries()) {
    items.push({ key: `doc_${n}`, headline: s.title, evidence: s.detail, leadWith: 'Wherever it fits the role: it comes from your own documents.', weight: 50 - n })
  }

  const ranked = items.sort((a, b) => b.weight - a.weight).slice(0, 5)
  const top = ranked[0]
  const role = i.targetRole ?? null
  const positioningLine =
    role && (i.function || i.yearsExperience) && top
      ? `${role}${i.yearsExperience ? ` with ${i.yearsExperience}+ years` : ''}${i.function ? ` in ${i.function}` : ''}. ${top.evidence.replace(/\.$/, '')}.`
      : null
  return { items: ranked, positioningLine }
}
