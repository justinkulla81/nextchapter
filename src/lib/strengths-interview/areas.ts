// Find your strengths: six areas, two free-form questions each (one on what you do best, one on where you are weaker),
// each followed by one AI follow-up that asks for the specifics. Most people cannot say what they are best at until
// someone asks the right question, so every question carries starters for when the box feels blank. Pure.

export type AreaKey = 'best_work' | 'skills' | 'industry' | 'how_you_work' | 'people' | 'motivation'

export interface InterviewQuestion {
  key: string
  kind: 'strength' | 'weakness'
  text: string
  /** Starters for a blank box: tapping one puts it in the answer to build on. */
  starters: string[]
}

export interface InterviewArea {
  key: AreaKey
  title: string
  why: string
  questions: InterviewQuestion[]
}

export const AREAS: InterviewArea[] = [
  {
    key: 'best_work',
    title: 'Your best work',
    why: 'One real story is the strongest proof you have. It becomes the heart of your pitch.',
    questions: [
      {
        key: 'proudest',
        kind: 'strength',
        text: 'What piece of work are you proudest of? What was going on, and what did you do?',
        starters: ['A problem I fixed was…', 'Something I built or launched was…', 'The time I saved the team from…'],
      },
      {
        key: 'result',
        kind: 'strength',
        text: 'What changed because of it? Numbers if you have them, or what people said.',
        starters: ['It went from … to …', 'My manager said…', 'It is still how they…'],
      },
    ],
  },
  {
    key: 'skills',
    title: 'The work itself',
    why: 'The things people come to you for are your edge on a job description, and the words recruiters search for.',
    questions: [
      {
        key: 'go_to',
        kind: 'strength',
        text: 'What do people come to you for at work, because you do it better than most?',
        starters: ['People bring me … when it is a mess', 'I am the one who knows how to…', 'Others avoid … but I am good at it'],
      },
      {
        key: 'weaker',
        kind: 'weakness',
        text: 'What part of the work do you put off, or know someone else does better?',
        starters: ['I put off…', 'I never really learned…', 'I usually hand … to someone else'],
      },
    ],
  },
  {
    key: 'industry',
    title: 'Your industry knowledge',
    why: 'Knowing how an industry really works saves an employer months. Most people undersell it because it feels obvious to them.',
    questions: [
      {
        key: 'insider',
        kind: 'strength',
        text: 'What do you know about your industry that a smart outsider would take a year to learn?',
        starters: ['How the money is really made:', 'The rules and regulators:', 'What customers actually care about:'],
      },
      {
        key: 'thin',
        kind: 'weakness',
        text: 'Where is your industry knowledge thin, or out of date?',
        starters: ['I have not kept up with…', 'I only know one side of…', 'Newer tools like…'],
      },
    ],
  },
  {
    key: 'how_you_work',
    title: 'How you work',
    why: 'Employers hire for how you get things done as much as for what you know.',
    questions: [
      {
        key: 'made_difference',
        kind: 'strength',
        text: 'Think of a project that went well because of you. What did you do that someone else might not have?',
        starters: ['I saw the problem coming and…', 'I kept everyone on the same page by…', 'I broke it into…'],
      },
      {
        key: 'worst',
        kind: 'weakness',
        text: 'What kind of work, or situation, brings out your worst?',
        starters: ['Too little structure', 'Constant interruptions', 'Slow decisions above me'],
      },
    ],
  },
  {
    key: 'people',
    title: 'People and pressure',
    why: 'How you handle people and pressure is what references talk about, and what interviews probe.',
    questions: [
      {
        key: 'hard_conversation',
        kind: 'strength',
        text: 'Tell us about a hard conversation, or a difficult person, you handled well. What did you do?',
        starters: ['A customer who…', 'Someone on my team who…', 'A boss who…'],
      },
      {
        key: 'feedback',
        kind: 'weakness',
        text: 'What feedback have you heard more than once that stung a little?',
        starters: ['That I am too direct', 'That I take on too much', 'That I am quiet in meetings'],
      },
    ],
  },
  {
    key: 'motivation',
    title: 'What drives you',
    why: 'People do their best work where their motivation is. This also steers the jobs we show you.',
    questions: [
      {
        key: 'flow',
        kind: 'strength',
        text: 'What kind of work makes you lose track of time?',
        starters: ['Untangling a messy problem', 'Teaching or coaching someone', 'Building something from nothing'],
      },
      {
        key: 'drains',
        kind: 'weakness',
        text: 'What drains you, even when you are good at it?',
        starters: ['Repeating the same task', 'Politics and status meetings', 'Work nobody uses'],
      },
    ],
  },
]

export const areaOf = (key: string): InterviewArea | undefined => AREAS.find((a) => a.key === key)

export interface SavedAnswer {
  questionKey: string
  question: string
  answer: string
  followUp?: string | null
  followUpAnswer?: string | null
}

export const MAX_ANSWER = 2000

/** Reads the stored answers JSON defensively: anything malformed is dropped. */
export function answersOf(json: unknown): SavedAnswer[] {
  if (!Array.isArray(json)) return []
  return json.flatMap((x) => {
    if (!x || typeof x !== 'object') return []
    const r = x as Record<string, unknown>
    if (typeof r.questionKey !== 'string' || typeof r.answer !== 'string') return []
    return [
      {
        questionKey: r.questionKey,
        question: typeof r.question === 'string' ? r.question : '',
        answer: r.answer,
        followUp: typeof r.followUp === 'string' ? r.followUp : null,
        followUpAnswer: typeof r.followUpAnswer === 'string' ? r.followUpAnswer : null,
      },
    ]
  })
}

/**
 * Where a member is inside one area: the next base question to ask, or a follow-up still waiting for its answer.
 * `skipped` holds question keys the member chose to skip this visit.
 */
export type Step = { kind: 'question'; question: InterviewQuestion } | { kind: 'followUp'; question: InterviewQuestion; followUp: string } | { kind: 'done' }

export function nextStep(area: InterviewArea, answers: SavedAnswer[], skipped: string[] = []): Step {
  for (const q of area.questions) {
    if (skipped.includes(q.key)) continue
    const a = answers.find((x) => x.questionKey === q.key)
    if (!a) return { kind: 'question', question: q }
    if (a.followUp && a.followUpAnswer == null && !skipped.includes(`${q.key}:follow`)) return { kind: 'followUp', question: q, followUp: a.followUp }
  }
  return { kind: 'done' }
}

/** Replaces (or adds) one question's answer; a new base answer clears its old follow-up. */
export function withAnswer(answers: SavedAnswer[], next: SavedAnswer): SavedAnswer[] {
  const rest = answers.filter((a) => a.questionKey !== next.questionKey)
  const order = (k: string) => AREAS.flatMap((a) => a.questions).findIndex((q) => q.key === k)
  return [...rest, next].sort((a, b) => order(a.questionKey) - order(b.questionKey))
}

export interface AreaSummary {
  strength: string
  proof: string
  watchOut: string | null
  sayIt: string
}

/** One area as the Find your strengths screens see it. */
export interface ReflectionRow {
  area: AreaKey
  answers: SavedAnswer[]
  summary: AreaSummary | null
  completed: boolean
  /** The member hid this strength from their Dossier. */
  hidden?: boolean
}
