// "Sharpen this report": the handful of inputs the report reads, which of them
// it already has, and what each remaining one would unlock. A completeness cue,
// not a score — there is no number to chase, only "what we do not know yet" and
// the one-step way to tell us. Pure.

import type { AnswerField } from './answers'

export interface SharpenItem {
  key: string
  label: string
  known: boolean
  /** What knowing it changes in this report. */
  unlocks: string
  /** How to supply it when unknown: an answer in place, or a link to the tool. */
  control: { kind: 'answer'; field: AnswerField } | { kind: 'link'; href: string; cta: string } | null
}

export interface SharpenInput {
  hasResume: boolean
  strategyComplete: boolean
  payFloor: number | null
  /** The member has applied, so "where it stalls" applies. */
  hasApplied: boolean
  searchStallPoint: string | null
  linkedInConfirmed: boolean
  skillsAssessmentDone: boolean
  roles: number
  completedReferences: number
  gmailConnected: boolean
}

export function buildSharpen(i: SharpenInput): SharpenItem[] {
  const items: SharpenItem[] = [
    { key: 'resume', label: 'Your resume', known: i.hasResume, unlocks: 'Every resume, experience and recruiter read in this report.', control: i.hasResume ? null : { kind: 'link', href: '/dashboard/resume', cta: 'Upload your resume' } },
    { key: 'work_history', label: 'Two or more roles of work history', known: i.roles >= 2, unlocks: 'Tenure, gaps, progression and the career timeline.', control: i.roles >= 2 ? null : { kind: 'link', href: '/dashboard/profile', cta: 'Add work history' } },
    { key: 'strategy', label: 'Your Search Strategy goals', known: i.strategyComplete, unlocks: 'The size of your market, the weekly volumes and the pivot options.', control: i.strategyComplete ? null : { kind: 'link', href: '/dashboard/search-strategy', cta: 'Finish your goals' } },
    { key: 'pay', label: 'The least you would take', known: i.payFloor !== null, unlocks: 'How many advertised roles clear your floor, and the pay row in the hiring case.', control: i.payFloor !== null ? null : { kind: 'answer', field: 'pay_floor' } },
    { key: 'linkedin', label: 'Your LinkedIn address', known: i.linkedInConfirmed, unlocks: 'The presence row: what a recruiter finds when they check you.', control: i.linkedInConfirmed ? null : { kind: 'answer', field: 'linkedin_url' } },
    { key: 'assessment', label: 'The skills assessment', known: i.skillsAssessmentDone, unlocks: 'Job matches, the skills gap and the learning plan become specific to you.', control: i.skillsAssessmentDone ? null : { kind: 'link', href: '/dashboard/skills-assessment', cta: 'Take the assessment' } },
    { key: 'references', label: 'A first reference', known: i.completedReferences >= 1, unlocks: 'Third-party proof in the hiring case and the executive recruiter view.', control: i.completedReferences >= 1 ? null : { kind: 'link', href: '/dashboard/references', cta: 'Ask for a reference' } },
    { key: 'gmail', label: 'Gmail connected', known: i.gmailConnected, unlocks: 'Applications, interviews and rejections are counted for you, replacing what you reported.', control: i.gmailConnected ? null : { kind: 'link', href: '/dashboard/email-activity', cta: 'Connect Gmail' } },
  ]
  if (i.hasApplied) {
    items.splice(4, 0, { key: 'stall', label: 'Where your searches usually stall', known: i.searchStallPoint !== null, unlocks: 'Which reader is losing you, so the first fix goes to the right place.', control: i.searchStallPoint !== null ? null : { kind: 'answer', field: 'search_stall' } })
  }
  return items
}
