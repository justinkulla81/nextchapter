// "Start here": the report's findings turned into the member's first week
// inside NextChapter. Each step names the tool that does the work, links
// straight to it, says which finding it answers, and shows as done once the
// member has done it — so a new member opens the report and has a first move
// in under a minute, and a returning member sees their progress.
//
// Pure. Stage-aware: tools the member's situation keeps locked
// (src/lib/journey/menu.ts) are not offered as steps; the step says what
// turns them on instead, so the plan never points at a door that is shut.

import { itemVisibility, MENU_LABELS, type MenuItemKey, type MenuMode } from '@/lib/journey/menu'
import { sectionNumber } from './sections'
import type { BriefArea } from './types'

export type Phase = 'today' | 'this_week' | 'weeks_2_4' | 'weeks_5_12'

export const PHASE_LABEL: Record<Phase, string> = {
  today: 'Today',
  this_week: 'This week',
  weeks_2_4: 'Weeks 2 to 4',
  weeks_5_12: 'Weeks 5 to 12',
}

export interface LaunchStep {
  key: string
  phase: Phase
  title: string
  /** The finding in this report the step answers. */
  because: string
  /** The product tool that does the work, by its menu name. */
  tool: string
  href: string
  minutes: number | null
  area: BriefArea
  done: boolean
  /** Set when the member's situation keeps the tool locked: what turns it on. */
  lockedNote: string | null
}

export interface LaunchpadInput {
  mode: MenuMode
  strategyComplete: boolean
  unconfirmedProfileItems: number
  hasResume: boolean
  resumeFixCount: number
  unansweredReviewerQuestions: number
  skillsAssessmentDone: boolean
  gmailConnected: boolean
  completedReferences: number
  /** Balanced-route weekly volumes from the Search requirements table; null when not estimated. */
  weekly: { applications: number; conversations: number } | null
  activityObserved: boolean
  topAiGap: string | null
  market: { prompt: 'too_many' | 'too_few' | 'shrinking' | 'healthy'; widest: string | null } | null
  pivotsShown: boolean
}

const LOCK_NOTE =
  'This tool turns on when you tell us you are ready to apply. The “Turn on more tools” box under the tab row does it in one click.'

function tool(key: MenuItemKey): string {
  return MENU_LABELS[key]
}

export function buildLaunchpad(i: LaunchpadInput): LaunchStep[] {
  const steps: LaunchStep[] = []
  const add = (s: Omit<LaunchStep, 'lockedNote'> & { lockedNote?: string | null }) => steps.push({ lockedNote: null, ...s })
  const jobsLocked = itemVisibility('jobs', i.mode) !== 'show'

  // Today: the inputs every estimate reads. Short, and each one improves this report.
  if (!i.strategyComplete) {
    add({ key: 'strategy', phase: 'today', title: 'Finish your Search Strategy goals', because: 'The market, the volumes and the pivot options are all sized from them.', tool: tool('strategy'), href: '/dashboard/search-strategy', minutes: 10, area: 'Profile', done: false })
  }
  if (i.unconfirmedProfileItems > 0) {
    add({ key: 'confirm', phase: 'today', title: `Confirm ${i.unconfirmedProfileItems} profile detail${i.unconfirmedProfileItems === 1 ? '' : 's'}`, because: 'Unconfirmed details are inferred from the resume and can be wrong.', tool: tool('profile'), href: '/dashboard/profile', minutes: 5, area: 'Profile', done: false })
  }
  if (!i.hasResume) {
    add({ key: 'resume_upload', phase: 'today', title: 'Upload your resume', because: 'The experience, resume and recruiter reads need it.', tool: tool('profile'), href: '/dashboard/resume', minutes: 3, area: 'Resume', done: false })
  }
  if (i.unansweredReviewerQuestions > 0) {
    add({ key: 'reviewer', phase: 'today', title: `Write a one-line answer to ${i.unansweredReviewerQuestions} recruiter question${i.unansweredReviewerQuestions === 1 ? '' : 's'}`, because: `Section ${sectionNumber('objections')} lists what you will be asked. A prepared answer removes the doubt.`, tool: tool('profile'), href: '#recruiter-read', minutes: 10, area: 'Experience', done: false })
  }

  // This week: fix the document, switch on tracking, start the rhythm.
  if (i.hasResume && i.resumeFixCount > 0) {
    add({ key: 'resume_fix', phase: 'this_week', title: `Fix the resume: ${i.resumeFixCount} change${i.resumeFixCount === 1 ? '' : 's'}, highest impact first`, because: 'The resume decides whether the first screen opens or stops.', tool: tool('profile'), href: '/dashboard/resume#resume-fixes', minutes: 45, area: 'Resume', done: false })
  }
  if (i.hasResume) {
    add({
      key: 'job_fit',
      phase: 'this_week',
      title: 'Paste a job you want and see how you read for it',
      because: `Section ${sectionNumber('read')} is how you read in general. Job Fit shows how you read for one real posting, with the gaps to close before you apply.`,
      tool: 'Job Fit',
      href: '/dashboard/job-fit',
      minutes: 5,
      area: 'Resume',
      done: false,
      lockedNote: jobsLocked ? LOCK_NOTE : null,
    })
  }
  if (!i.skillsAssessmentDone) {
    add({ key: 'assessment', phase: 'this_week', title: 'Take the skills assessment', because: 'It makes job matches, the skills gap and the learning plan specific to you.', tool: tool('assessments'), href: '/dashboard/skills-assessment', minutes: 15, area: 'Skills', done: false })
  }
  if (!i.gmailConnected) {
    add({ key: 'gmail', phase: 'this_week', title: 'Connect Gmail so applications and replies count themselves', because: 'Search activity in this report updates from your mail, with nothing to log by hand.', tool: tool('inbox'), href: '/dashboard/email-activity', minutes: 2, area: 'Search activity', done: false })
  }
  if (i.weekly) {
    add({ key: 'network', phase: 'this_week', title: `Plan ${i.weekly.conversations} conversations a week`, because: 'Conversations convert several times better than applications at this level.', tool: tool('network'), href: '/dashboard/network', minutes: 30, area: 'Search activity', done: i.activityObserved })
  }
  add({ key: 'references', phase: 'this_week', title: 'Ask three people for a reference', because: 'Third-party proof is what turns your claims into verified ones.', tool: tool('references'), href: '/dashboard/references', minutes: 15, area: 'Experience', done: i.completedReferences >= 3 })

  // Weeks 2 to 4: build, then apply once the search tools are on.
  if (i.topAiGap) {
    add({ key: 'ai_gap', phase: 'weeks_2_4', title: `Close one skill gap: ${i.topAiGap}`, because: 'Employers with jobs that fit you ask for it and it is not on your profile.', tool: tool('learning'), href: '/dashboard/learning#ai-skills-for-your-search', minutes: null, area: 'Skills', done: false })
  }
  if (i.weekly) {
    add({
      key: 'apply',
      phase: 'weeks_2_4',
      title: `Apply to ${i.weekly.applications} well-matched roles a week`,
      because: 'Volume only helps when each application is a strong fit. The board ranks them for you.',
      tool: tool('jobs'),
      href: '/dashboard/find-my-job',
      minutes: null,
      area: 'Search activity',
      done: false,
      lockedNote: jobsLocked ? LOCK_NOTE : null,
    })
  }
  add({ key: 'companies', phase: 'weeks_2_4', title: 'Pick 10 target companies and find one person at each', because: 'Introductions are how most roles at this level are filled.', tool: tool('companies'), href: '/dashboard/companies', minutes: 30, area: 'Search activity', done: false })

  // Weeks 5 to 12: adjust on evidence.
  if (i.market && (i.market.prompt === 'too_few' || i.market.prompt === 'shrinking')) {
    add({ key: 'widen', phase: 'weeks_5_12', title: i.market.widest ? `Widen the search: ${i.market.widest}` : 'Widen the search', because: 'The current target is thin. Lifting one limit opens the most roles.', tool: tool('strategy'), href: '/dashboard/search-strategy', minutes: 10, area: 'Market', done: false })
  }
  if (i.pivotsShown) {
    add({ key: 'pivot', phase: 'weeks_5_12', title: 'Test one pivot alongside the main search', because: `Section ${sectionNumber('direction')} names the options with the most open roles and the best fit.`, tool: 'Pivot paths', href: '/dashboard/pivot-paths', minutes: 20, area: 'Market', done: false })
  }
  add({ key: 'recheck', phase: 'weeks_5_12', title: 'Re-read this report at week 6 and week 12', because: 'It recalculates from your own results, so the estimates sharpen as you go.', tool: tool('marketReality'), href: '/dashboard/market-reality', minutes: 10, area: 'Search activity', done: false })

  return steps
}

/** The first step still to do: the one the report's primary button opens. */
export function firstStep(steps: LaunchStep[]): LaunchStep | null {
  return steps.find((s) => !s.done && !s.lockedNote) ?? null
}
