'use client'

import { PreviewShell } from '@/components/candidate/PreviewShell'
import { StrengthInterview, type InterviewActions } from '@/components/dashboard/why-hire/StrengthInterview'
import type { ReflectionRow } from '@/lib/strengths-interview/areas'

// Find your strengths, the real component with sample answers and a stand-in for the saves, so nothing is written.
const wait = () => new Promise((r) => setTimeout(r, 600))
const actions: InterviewActions = {
  save: async (i) => {
    await wait()
    return { ok: true, answers: [{ questionKey: i.questionKey, question: '', answer: i.text, followUp: i.isFollowUp ? null : 'You said you rebuilt the planning cadence. What did on-time delivery look like before, and after?', followUpAnswer: i.isFollowUp ? i.text : null }] }
  },
  skipFollowUp: async () => ({ ok: true, answers: [] }),
  setHidden: async () => {
    await wait()
    return { ok: true }
  },
  finish: async () => {
    await wait()
    return { ok: true, summary: DONE[0].summary! }
  },
}

const DONE: ReflectionRow[] = [
  {
    area: 'best_work',
    completed: true,
    answers: [],
    summary: {
      strength: 'Getting a slipping operation back on plan',
      proof: 'Took a 140-person fulfillment network from 81% to 97% on-time delivery in two quarters by rebuilding weekly planning.',
      watchOut: null,
      sayIt: 'When an operation is missing its numbers, I find the one broken routine underneath it and fix that first: that took us from 81% to 97% on time.',
    },
  },
  {
    area: 'skills',
    completed: true,
    answers: [],
    summary: {
      strength: 'Turning messy data into a plan people follow',
      proof: 'Colleagues bring their forecasting problems to you because you can make the numbers tie and explain them simply.',
      watchOut: 'You put off vendor negotiations. Prepare one example of a contract you closed, or pick roles where procurement owns it.',
      sayIt: 'People bring me the forecast nobody trusts, and I turn it into a plan the floor actually follows.',
    },
  },
]

const FOLLOW: ReflectionRow[] = [
  ...DONE,
  {
    area: 'industry',
    completed: false,
    summary: null,
    answers: [
      {
        questionKey: 'insider',
        question: '',
        answer: 'How carriers actually price freight. The posted rates are fiction: what matters is lane density and when in the quarter you book.',
        followUp: 'You said lane density matters more than posted rates. When did knowing that save your company money, and roughly how much?',
        followUpAnswer: null,
      },
    ],
  },
]

const Shell = ({ children }: { children: React.ReactNode }) => (
  <PreviewShell place="jobs" entry="apply" part="whyhire">
    <div className="max-w-2xl">{children}</div>
  </PreviewShell>
)

export const InterviewHub = () => <Shell><StrengthInterview area={null} rows={DONE} actions={actions} /></Shell>
export const InterviewHubNew = () => <Shell><StrengthInterview area={null} rows={[]} actions={actions} /></Shell>
export const InterviewQuestion = () => <Shell><StrengthInterview area="how_you_work" rows={DONE} actions={actions} /></Shell>
export const InterviewFollowUp = () => <Shell><StrengthInterview area="industry" rows={FOLLOW} actions={actions} /></Shell>
export const InterviewReveal = () => <Shell><StrengthInterview area="skills" rows={DONE} actions={actions} /></Shell>
