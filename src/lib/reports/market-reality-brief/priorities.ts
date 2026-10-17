// The ranked "what to do first" list at the top of the report. Pure: takes
// the already-computed findings from each section and orders the handful of
// actions that move the search most. Rules, not AI — each action names the
// evidence it rests on, so it can never say something the sections below
// don't.

import type { BriefArea, PriorityAction } from './types'

export const MAX_PRIORITIES = 5

export interface PrioritySignals {
  resume: { topFix: { dimension: string; fix: string; gain: number } | null; fixCount: number } | null
  experience: { openQuestions: number } | null
  /** Unanswered "how a recruiter will read this" questions. */
  unansweredReviewerQuestions: number
  effort: {
    coverage: number
    activityObserved: boolean
    conversationsPerWeek: number
    balancedConversationsPerWeek: number
    balancedApplicationsPerWeek: number
  } | null
  market: {
    prompt: 'too_many' | 'too_few' | 'shrinking' | 'healthy'
    openRoles: number
    widest: { label: string; openRoles: number } | null
  } | null
  skills: { topAiGap: { term: string; employers: number; of: number } | null } | null
  unconfirmedProfileItems: number
  /** The required Search Strategy goals are not all set. */
  searchStrategyIncomplete: boolean
  pivotsRecommended: boolean
}

const MORE_THAN_ONE = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function buildPriorities(s: PrioritySignals): PriorityAction[] {
  const out: PriorityAction[] = []
  const add = (a: Omit<PriorityAction, 'area'> & { area: BriefArea }) => out.push(a)

  if (s.effort) {
    const e = s.effort
    if (!e.activityObserved) {
      add({
        key: 'start_activity',
        area: 'Search activity',
        title: `Start the weekly rhythm: ${e.balancedConversationsPerWeek} conversations and ${e.balancedApplicationsPerWeek} applications a week`,
        rationale: 'No applications or networking are logged in the last four weeks. This is the pace the Search requirements table says a market like yours typically takes.',
        href: '/dashboard',
        cta: 'Open the weekly sprint',
        weight: 88,
      })
    } else if (e.coverage < 0.5) {
      add({
        key: 'raise_pace',
        area: 'Search activity',
        title: `Raise the pace to ${e.balancedConversationsPerWeek} conversations and ${e.balancedApplicationsPerWeek} applications a week`,
        rationale: `At the current pace the search is on track to produce about ${Math.round(e.coverage * 100)}% of the interviews it typically takes to reach one offer within 12 weeks.`,
        href: '/dashboard/network',
        cta: 'Plan this week’s outreach',
        weight: 86,
      })
    } else if (e.coverage < 1) {
      add({
        key: 'close_pace_gap',
        area: 'Search activity',
        title: 'Close the remaining gap in weekly activity',
        rationale: `The current pace covers about ${Math.round(e.coverage * 100)}% of what it typically takes. Conversations convert far better than applications at this level, so add them first.`,
        href: '/dashboard/network',
        cta: 'Plan this week’s outreach',
        weight: 62,
      })
    }
  }

  if (s.market) {
    const m = s.market
    if (m.prompt === 'too_few' || m.prompt === 'shrinking') {
      add({
        key: 'widen_market',
        area: 'Market',
        title: m.widest ? `Widen the search: ${m.widest.label} has ${m.widest.openRoles.toLocaleString()} open roles` : 'Widen the search beyond the current target',
        rationale:
          m.prompt === 'too_few'
            ? `Only ${m.openRoles.toLocaleString()} open roles fit the current target on level, field, place and skills. A search this narrow depends on a few postings, so one more constraint should be relaxed.`
            : `The target market is shrinking against the rest of the board (${m.openRoles.toLocaleString()} open roles fit now). Position for the nearby areas that are growing.`,
        href: '/dashboard/search-strategy',
        cta: 'Review the search target',
        weight: 78,
      })
    } else if (m.prompt === 'too_many') {
      add({
        key: 'narrow_market',
        area: 'Market',
        title: 'Narrow the search to the roles where the story is strongest',
        rationale: `${m.openRoles.toLocaleString()} open roles fit. That is more than anyone can work through well, and a broad search reads as an unfocused candidate. Pick the one or two slices to work first.`,
        href: '/dashboard/find-my-job',
        cta: 'Open the job board',
        weight: 52,
      })
    }
  }

  if (s.searchStrategyIncomplete) {
    add({
      key: 'complete_search_strategy',
      area: 'Profile',
      title: 'Finish your Search Strategy goals',
      rationale: 'Target role, industries, company size and stage, and work arrangement decide which roles count toward your market and how the volumes below are read. Until they are set, the market is sized on inference.',
      href: '/dashboard/search-strategy',
      cta: 'Open Search Strategy',
      weight: 90,
    })
  }

  if (s.unconfirmedProfileItems >= 2) {
    add({
      key: 'confirm_profile',
      area: 'Profile',
      title: `Confirm ${MORE_THAN_ONE(s.unconfirmedProfileItems, 'profile detail')} so the assessment is exact`,
      rationale: 'Matching, market size and the estimates in this report read the profile. Unconfirmed details are inferred from the resume and can be wrong.',
      href: '/dashboard/profile',
      cta: 'Confirm profile',
      weight: 66,
    })
  }

  if (s.resume?.topFix) {
    add({
      key: 'fix_resume',
      area: 'Resume',
      title: `Fix the resume: ${s.resume.topFix.dimension.toLowerCase()} first${s.resume.fixCount > 1 ? ` (${s.resume.fixCount} fixes listed)` : ''}`,
      rationale: s.resume.topFix.fix,
      href: '/dashboard/resume#resume-fixes',
      cta: 'Open the resume editor',
      weight: 60 + Math.min(s.resume.topFix.gain, 25),
    })
  }

  if (s.unansweredReviewerQuestions > 0 || (s.experience && s.experience.openQuestions > 0)) {
    const n = Math.max(s.unansweredReviewerQuestions, s.experience?.openQuestions ?? 0)
    add({
      key: 'answer_reviewer_questions',
      area: 'Experience',
      title: `Prepare a one-line answer for ${MORE_THAN_ONE(n, 'question')} a reviewer will ask`,
      rationale: 'Gaps, short stints and level changes are read in the first minute. An unexplained one costs more than the real reason would.',
      href: '#recruiter-read',
      cta: 'Answer them below',
      weight: 70,
    })
  }

  if (s.skills?.topAiGap) {
    const g = s.skills.topAiGap
    add({
      key: 'close_ai_gap',
      area: 'Skills',
      title: `Add ${g.term} to your profile, or build it`,
      rationale: `${g.employers} of ${g.of} employers with jobs that fit you ask for it, and it is not on your profile. If you have it, add it; if not, one course closes the gap.`,
      href: '/dashboard/learning#ai-skills-for-your-search',
      cta: 'See the course',
      weight: 50 + Math.min(20, Math.round((g.employers / Math.max(1, g.of)) * 20)),
    })
  }

  if (s.pivotsRecommended) {
    add({
      key: 'consider_pivots',
      area: 'Market',
      title: 'Test one pivot alongside the main search',
      rationale: 'The main target is thin or the case for a change is strong. A parallel pivot costs little and shows within weeks whether it has traction.',
      href: '/dashboard/pivot-paths',
      cta: 'See pivot paths',
      weight: 44,
    })
  }

  return out.sort((a, b) => b.weight - a.weight).slice(0, MAX_PRIORITIES)
}
