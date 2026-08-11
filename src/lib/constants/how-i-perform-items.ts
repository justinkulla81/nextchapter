// "How I Perform" self-report item bank — Assessment Layer spec Part 3.3.
// Frozen, version-controlled text (not AI-generated at seed time, unlike the
// How I Work Best quad/Likert banks) — 40 items, 4-point agreement scale,
// 8 items per dimension. isReversed items get their raw 1-4 score flipped
// (5 - raw) before averaging into the dimension mean.
//
// ADA constraint (spec §3.3, non-negotiable): every Composure item describes
// observable behavior, never phrasing that reads as screening for a mental
// health condition. Check any new item against that before it ships.

export type PerformanceDimension = 'EXECUTION' | 'JUDGMENT' | 'COMPOSURE' | 'INFLUENCE' | 'INTEGRITY'

export const PERFORMANCE_DIMENSION_ORDER: PerformanceDimension[] = [
  'EXECUTION',
  'JUDGMENT',
  'COMPOSURE',
  'INFLUENCE',
  'INTEGRITY',
]

export const PERFORMANCE_DIMENSION_LABEL: Record<PerformanceDimension, string> = {
  EXECUTION: 'Execution',
  JUDGMENT: 'Judgment',
  COMPOSURE: 'Composure',
  INFLUENCE: 'Influence',
  INTEGRITY: 'Integrity',
}

export interface PerformanceItem {
  id: number // 1-40, stable — never renumber once live responses exist
  dimension: PerformanceDimension
  text: string
  isReversed: boolean
}

export const HOW_I_PERFORM_ITEMS: PerformanceItem[] = [
  // EXECUTION (1-8)
  { id: 1, dimension: 'EXECUTION', text: 'Over the past year, I delivered what I committed to on the timeline I set.', isReversed: false },
  { id: 2, dimension: 'EXECUTION', text: 'In the last several months, things I owned slipped past their dates more than once.', isReversed: true },
  { id: 3, dimension: 'EXECUTION', text: 'Over recent months, I finished what I started even after the work stopped being interesting.', isReversed: false },
  { id: 4, dimension: 'EXECUTION', text: 'In the past year, I lost momentum on projects that ran long.', isReversed: true },
  { id: 5, dimension: 'EXECUTION', text: 'Over the past year, I ran my area without needing someone to check on me.', isReversed: false },
  { id: 6, dimension: 'EXECUTION', text: 'In the last several months, I needed prompting to get things over the line.', isReversed: true },
  { id: 7, dimension: 'EXECUTION', text: 'Over recent months, I set a higher bar for my output than anyone required of me.', isReversed: false },
  { id: 8, dimension: 'EXECUTION', text: "In the past year, I stopped at good enough more often than I'd like.", isReversed: true },

  // JUDGMENT (9-16)
  { id: 9, dimension: 'JUDGMENT', text: 'Over the past year, my calls held up when the situation was genuinely unclear.', isReversed: false },
  { id: 10, dimension: 'JUDGMENT', text: 'In the last several months, decisions I made had to be reversed.', isReversed: true },
  { id: 11, dimension: 'JUDGMENT', text: 'Over recent months, I knew which decisions to escalate and which to make myself.', isReversed: false },
  { id: 12, dimension: 'JUDGMENT', text: 'In the past year, I escalated things I should have handled, or handled things I should have escalated.', isReversed: true },
  { id: 13, dimension: 'JUDGMENT', text: 'Over the past year, I read situations correctly before acting on them.', isReversed: false },
  { id: 14, dimension: 'JUDGMENT', text: 'In the last several months, I misjudged what was actually going on more than once.', isReversed: true },
  { id: 15, dimension: 'JUDGMENT', text: 'Over recent months, I changed course when the evidence changed.', isReversed: false },
  { id: 16, dimension: 'JUDGMENT', text: 'In the past year, I stayed with an approach past the point it was working.', isReversed: true },

  // COMPOSURE (17-24)
  { id: 17, dimension: 'COMPOSURE', text: 'Over the past year, I stayed level when deadlines moved without warning.', isReversed: false },
  { id: 18, dimension: 'COMPOSURE', text: 'In the last several months, setbacks stayed with me and affected the rest of my day.', isReversed: true },
  { id: 19, dimension: 'COMPOSURE', text: 'Over recent months, I took hard feedback and kept working.', isReversed: false },
  { id: 20, dimension: 'COMPOSURE', text: 'In the past year, pressure made me short with the people around me.', isReversed: true },
  { id: 21, dimension: 'COMPOSURE', text: 'Over the past year, I thought clearly in the middle of a genuine crisis at work.', isReversed: false },
  { id: 22, dimension: 'COMPOSURE', text: 'In the last several months, high-stakes moments threw me off my game.', isReversed: true },
  { id: 23, dimension: 'COMPOSURE', text: 'When a plan fell apart over the past year, I moved to the next option quickly.', isReversed: false },
  { id: 24, dimension: 'COMPOSURE', text: 'Over recent months, I replayed difficult work conversations long after they ended.', isReversed: true },

  // INFLUENCE (25-32)
  { id: 25, dimension: 'INFLUENCE', text: "Over the past year, I got outcomes through people who didn't report to me.", isReversed: false },
  { id: 26, dimension: 'INFLUENCE', text: 'In the last several months, I struggled to move things without formal authority.', isReversed: true },
  { id: 27, dimension: 'INFLUENCE', text: 'Over recent months, people more senior than me took my view seriously.', isReversed: false },
  { id: 28, dimension: 'INFLUENCE', text: 'In the past year, I had trouble being heard by people above my level.', isReversed: true },
  { id: 29, dimension: 'INFLUENCE', text: 'Over the past year, I said the unwelcome thing when it needed saying.', isReversed: false },
  { id: 30, dimension: 'INFLUENCE', text: 'In the last several months, I stayed quiet on things I should have raised.', isReversed: true },
  { id: 31, dimension: 'INFLUENCE', text: 'Over recent months, I built support for a position before it needed a decision.', isReversed: false },
  { id: 32, dimension: 'INFLUENCE', text: 'In the past year, I brought people along too late to change the outcome.', isReversed: true },

  // INTEGRITY (33-40)
  { id: 33, dimension: 'INTEGRITY', text: 'Over the past year, I flagged my own mistakes before anyone else found them.', isReversed: false },
  { id: 34, dimension: 'INTEGRITY', text: 'In the last several months, I let credit come to me that I only partly earned.', isReversed: true },
  { id: 35, dimension: 'INTEGRITY', text: "Over recent months, I told people things they didn't want to hear because they were true.", isReversed: false },
  { id: 36, dimension: 'INTEGRITY', text: 'In the past year, I bent a rule where the outcome justified it and nobody was harmed.', isReversed: true },
  { id: 37, dimension: 'INTEGRITY', text: 'Over the past year, I held myself to the standard I held others to.', isReversed: false },
  { id: 38, dimension: 'INTEGRITY', text: 'In the last several months, I presented my role in past work more favorably than it strictly was.', isReversed: true },
  { id: 39, dimension: 'INTEGRITY', text: 'Over recent months, I raised a concern that cost me something to raise.', isReversed: false },
  { id: 40, dimension: 'INTEGRITY', text: "In the past year, getting ahead meant managing how things looked more than I'd like.", isReversed: true },
]
