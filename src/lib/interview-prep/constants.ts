export interface ToughQuestion {
  id: string
  category: 'objection' | 'trap'
  question: string
}

// Objection questions surface a real concern an interviewer might have and
// ask the candidate to address it directly. Trap questions are phrased to
// invite an answer that backfires (badmouthing a former employer, vague
// deflection) if the candidate isn't ready for them.
export const TOUGH_QUESTIONS: ToughQuestion[] = [
  { id: 'gap', category: 'objection', question: "I see a gap in your work history — walk me through it." },
  { id: 'overqualified', category: 'objection', question: 'Honestly, this role looks like a step down for you. Why would you take it?' },
  { id: 'jobhop', category: 'objection', question: "You've changed jobs pretty frequently — how do I know you'll stick around?" },
  { id: 'why-leaving', category: 'trap', question: 'Why are you leaving your current job?' },
  { id: 'worst-boss', category: 'trap', question: 'Tell me about the worst manager you ever worked for.' },
  { id: 'salary', category: 'trap', question: "What's your current salary, and what are you looking for?" },
  { id: 'weakness', category: 'trap', question: "What's your biggest weakness?" },
]

// Profile-specific practice prompts — the framing is generic on purpose;
// the candidate's own experience below fills in the specifics when Claude
// evaluates their answer.
export const PRACTICE_QUESTION_TEMPLATES = [
  'Tell me about a time you had to deliver a result under a tight deadline.',
  'Describe a situation where you disagreed with a decision — what did you do?',
  "What's an accomplishment from your current or most recent role that you're proud of?",
  'Tell me about a time you had to learn something completely new to do your job.',
  'Describe how you handled a conflict with a coworker or manager.',
] as const
