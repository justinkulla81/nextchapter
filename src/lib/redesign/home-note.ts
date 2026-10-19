// Home has one note. Many things want to be the note (a coach's questions, a stalled search, the first
// week's step, a bonus), so this picks the one that matters most today and gives it the same shape:
// what to do, why it matters, how to start. The rest wait. Pure: src/test/redesign-home-note.test.ts.
//
// Notes with their own flow (a stalled search, a change of situation, a playbook step, connecting accounts,
// a culture survey) keep their own card in the same place; this still decides when they win.

import type { FirstWeekStep } from '@/lib/onboarding/first-week'
import { noteWhyWithMotivation } from '@/lib/personalization/blocker-step'

export type HomeNoteKind =
  | 'coaching_form'
  | 'setup_strategy'
  | 'report_ready'
  | 'connect_accounts'
  | 'stalled_search'
  | 'passive_to_active'
  | 'first_week'
  | 'got_hired'
  | 'search_playbook'
  | 'culture_survey'

export interface HomeNoteInputs {
  needsCoachingForm: boolean
  searchStrategyIncomplete: boolean
  reportReady: boolean
  accountsNotConnected: boolean
  stalledSearch: boolean
  passiveToActive: boolean
  firstWeek: FirstWeekStep | null
  gotHired: boolean
  searchPlaybook: boolean
}

/** The one note for today. Time-sensitive and setup first, then nudges, then prompts. */
export function pickHomeNote(i: HomeNoteInputs): HomeNoteKind {
  if (i.needsCoachingForm) return 'coaching_form'
  if (i.searchStrategyIncomplete) return 'setup_strategy'
  if (i.reportReady) return 'report_ready'
  if (i.accountsNotConnected) return 'connect_accounts'
  if (i.stalledSearch) return 'stalled_search'
  if (i.passiveToActive) return 'passive_to_active'
  if (i.firstWeek) return 'first_week'
  if (i.gotHired) return 'got_hired'
  if (i.searchPlaybook) return 'search_playbook'
  return 'culture_survey'
}

export interface HomeNoteContent {
  title: string
  why: string
  startLabel: string
  startHref: string
  whyDetail: string
}

/** The note's words, for the kinds that are a plain "do this, because". Null: that kind keeps its own card. */
export function simpleNote(kind: HomeNoteKind, ctx: { firstName: string; firstWeek: FirstWeekStep | null; motivations: readonly string[] }): HomeNoteContent | null {
  switch (kind) {
    case 'coaching_form':
      return {
        title: 'Answer a few quick questions from your coach',
        why: 'Your coach uses them to prepare for your first session.',
        startLabel: 'Answer now',
        startHref: '/dashboard/coaching-form',
        whyDetail: 'You shared your profile with a coach, so this is the one thing they are waiting on. It takes a couple of minutes.',
      }
    case 'setup_strategy':
      return {
        title: `Welcome, ${ctx.firstName}. Start with your search strategy.`,
        why: noteWhyWithMotivation('It tailors your plan, your job matches and your dossier to you. About 5 minutes', ctx.motivations),
        startLabel: 'Start',
        startHref: '/dashboard/search-strategy',
        whyDetail: 'Everything else is tailored from what you tell us here, so it is the first step. You can change any answer later.',
      }
    case 'report_ready':
      return {
        title: 'Your market report is ready',
        why: 'It shows where your search stands today and what would move it most.',
        startLabel: 'Read my report',
        startHref: '/dashboard/market-reality',
        whyDetail: 'We built it from your profile and the market for your kind of role. You see it once, as your starting point.',
      }
    case 'first_week': {
      const s = ctx.firstWeek
      if (!s) return null
      return {
        title: s.title,
        why: noteWhyWithMotivation(`${s.why} About ${s.minutes} minutes`, ctx.motivations),
        startLabel: s.cta,
        startHref: s.href,
        whyDetail: `This is day ${s.day} of your first week: one small step a day, each pointing at something that already exists.`,
      }
    }
    case 'got_hired':
      return {
        title: 'Landed a job through NextChapter?',
        why: 'Tell us about it and claim your $500 Offer Bonus. We check offer letters before paying out.',
        startLabel: 'I got an offer',
        startHref: '/dashboard/got-hired',
        whyDetail: 'You see this from week 2 until you tell us. It never changes your search.',
      }
    default:
      return null
  }
}
