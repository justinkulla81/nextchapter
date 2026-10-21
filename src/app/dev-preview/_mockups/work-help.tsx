'use client'

import { PreviewShell } from '@/components/candidate/PreviewShell'
import { WorkHelpFlow, type WorkHelpActions } from '@/components/work-help/WorkHelpFlow'
import { OPTION_CATALOG, type WorkAnalysis, type WorkQuestionView } from '@/lib/work-help/constants'

// The real screens with sample answers. Nothing here reaches the server or the AI.
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

const ANALYSIS: WorkAnalysis = {
  acknowledgement: 'Having your work credited to someone else is frustrating, and it is common. It is usually fixable.',
  needsLegalPointer: false,
  generic: false,
  options: [
    { key: 'document_impact', why: 'credit goes to whoever is on record, and a short weekly note fixes that without a confrontation', firstStep: 'Each Friday, send your manager and their boss three lines on what you shipped. Keep a copy. Your impact log already holds the facts.' },
    { key: 'talk_directly', why: 'they may not know how it lands, and a calm conversation can fix it early', firstStep: 'Pick one example. Try: "I want to talk about how the board update went, because I think we can handle credit better."' },
    { key: 'internal_move', why: 'a new manager can reset this without leaving the company', firstStep: 'Check internal roles that report to a different leader and ask for a short conversation.' },
    { key: 'look_outside', why: 'if nothing changes, you keep your options open', firstStep: 'Confirm your privacy settings first, then browse roles for a week without applying.' },
  ].map((o) => {
    const c = OPTION_CATALOG[o.key as keyof typeof OPTION_CATALOG]
    return { ...o, key: o.key as keyof typeof OPTION_CATALOG, title: c.title, actionLabel: c.actionLabel, href: c.href }
  }),
}

const MINE: WorkQuestionView[] = [
  {
    id: 'q1',
    handle: 'SteadyNavigator412',
    title: 'How do you handle a manager who takes credit for your work?',
    body: 'I lead operations projects at a mid-size company.',
    createdAt: '2026-10-12T14:00:00.000Z',
    status: 'PUBLISHED',
    replies: [
      { id: 'r1', handle: 'CalmPathfinder208', body: 'A short written update to your manager and their boss every week fixed this for me. It put my name on the record without a fight.', createdAt: '2026-10-13T09:00:00.000Z', mine: false },
      { id: 'r2', handle: 'QuietAnalyst731', body: 'I asked for five minutes in my next one-on-one and named one specific meeting. They had not realized.', createdAt: '2026-10-14T16:00:00.000Z', mine: false },
    ],
  },
]

const OTHERS: WorkQuestionView[] = [
  {
    id: 'o1',
    handle: 'BrightBuilder519',
    title: 'How do you tell a direct report their work is not meeting the bar?',
    body: 'I manage a small team at a large company. One person is well liked but keeps missing deadlines. I have hinted at it twice. What worked for you?',
    createdAt: '2026-10-16T11:00:00.000Z',
    status: 'PUBLISHED',
    replies: [],
  },
  {
    id: 'o2',
    handle: 'ResilientOperator140',
    title: 'Is it worth staying when the workload never lets up?',
    body: 'My team lost two people and none were replaced. I am covering three roles. How did you decide whether to push back or leave?',
    createdAt: '2026-10-17T08:00:00.000Z',
    status: 'PUBLISHED',
    replies: [],
  },
]

const ACTIONS: WorkHelpActions = {
  analyze: async () => (await wait(600), { ok: true, analysis: ANALYSIS }),
  prepare: async () => (
    await wait(800),
    {
      ok: true,
      question: {
        title: 'How do you handle a manager who takes credit for your work?',
        body: 'I lead operations projects at a mid-size company. In meetings with senior leaders, my manager presents my work as theirs. I have not raised it yet. What worked for you?',
        removed: ['Your company name', 'Names of people', 'Your team, office or city', 'Your exact job title'],
      },
    }
  ),
  post: async () => (await wait(600), { ok: true, status: 'PUBLISHED', handle: 'SteadyNavigator412' }),
  remove: async () => (await wait(300), { ok: true }),
  reply: async () => (await wait(500), { ok: true, held: false }),
  report: async () => (await wait(300), { ok: true }),
}

export function WorkHelpMock() {
  return (
    <PreviewShell place="help" entry="work">
      <WorkHelpFlow actions={ACTIONS} initialMine={MINE} initialOthers={OTHERS} />
    </PreviewShell>
  )
}
