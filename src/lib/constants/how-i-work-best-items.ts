// "How I Work Best" frozen item bank — Assessment Layer spec Part 2.3.
// Replaces the old quad-block + AI-generated Likert content for newly
// seeded rotationGroup 3 (see CURRENT_ASSESSMENT_ROTATION_GROUP). Quad-block
// content and older rotationGroups are left in the DB untouched — spec §2.1
// says "warehouse it," not delete it, and Part 0.2 forbids hard deletes of
// anything a real candidate response could reference.
//
// 4-point agreement scale, no midpoint. isReversed items get their raw 1-4
// score flipped (5 - raw) before averaging into the dimension mean, same
// convention as How I Perform.
//
// Item 11 (Definition dimension) is intentionally FORWARD-keyed here even
// though its old Architecture-only wording reads as a "designs the process"
// statement that used to be reverse-keyed under the pre-merge dimension —
// spec §2.3 flags this explicitly: designing the process is the HIGH pole
// under the merged Definition dimension, not the low pole. Do not "fix" this
// to match the old Architecture keying.
//
// Ordering: positions below are a fixed, constraint-satisfying interleave
// (round-robin across all 7 dimensions, strictly alternating forward/
// reverse) rather than the spec's "randomize per candidate, store the order
// used." True per-candidate constrained randomization is deferred — a
// polish item, not a data-correctness one; every candidate seeing the same
// well-interleaved order still avoids the same-dimension/same-direction
// run-length problems the ordering rules exist to prevent. The spec's
// "attention check" and "near-duplicate pair" insertions (§2.3 ordering
// rules) are also deliberately omitted here — no item text was given for
// either, and inventing wording for them would be guessing at content the
// spec didn't actually specify, not filling in an implementation detail.

export type WorkStyleDimension =
  | 'VELOCITY'
  | 'DEFINITION'
  | 'COLLABORATION'
  | 'DIRECTNESS'
  | 'OVERSIGHT'
  | 'COMMITMENT'
  | 'RIGOR'

export const WORK_STYLE_DIMENSION_ORDER: WorkStyleDimension[] = [
  'VELOCITY',
  'DEFINITION',
  'COLLABORATION',
  'DIRECTNESS',
  'OVERSIGHT',
  'COMMITMENT',
  'RIGOR',
]

export const WORK_STYLE_DIMENSION_LABEL: Record<WorkStyleDimension, string> = {
  VELOCITY: 'Velocity',
  DEFINITION: 'Definition',
  COLLABORATION: 'Collaboration',
  DIRECTNESS: 'Directness',
  OVERSIGHT: 'Oversight',
  COMMITMENT: 'Commitment',
  RIGOR: 'Rigor',
}

// Low/high pole labels — no pole is "better." Report copy referencing these
// must hold that framing everywhere (spec §2.2).
export const WORK_STYLE_DIMENSION_POLES: Record<WorkStyleDimension, { low: string; high: string }> = {
  VELOCITY: { low: 'Deliberate and planned', high: 'Fast and urgent' },
  DEFINITION: { low: 'Works best from a defined plan', high: 'Works best defining the plan' },
  COLLABORATION: { low: 'Focused and written', high: 'Live and together' },
  DIRECTNESS: { low: 'Coaching and context', high: 'Direct and blunt' },
  OVERSIGHT: { low: 'Hands-off', high: 'Deeply involved' },
  COMMITMENT: { low: 'Protects boundaries', high: 'Whatever it takes' },
  RIGOR: { low: 'Flexible with process', high: 'Rigorous with detail' },
}

export interface WorkStyleItem {
  id: number // 1-56, stable presentation position — never renumber once live responses exist
  dimension: WorkStyleDimension
  text: string
  isReversed: boolean
}

// Presentation-ordered (see file header) — position === id.
export const HOW_I_WORK_BEST_ITEMS: WorkStyleItem[] = [
  { id: 1, dimension: 'VELOCITY', text: 'Over the past year, when a new request came in, I typically began working on it the same day rather than scheduling it for later.', isReversed: false },
  { id: 2, dimension: 'VELOCITY', text: 'In the last several months, I usually mapped out a full plan before taking any action on a project.', isReversed: true },
  { id: 3, dimension: 'DEFINITION', text: 'In the past year, I took on projects that started with only a rough goal and no defined steps.', isReversed: false },
  { id: 4, dimension: 'DEFINITION', text: 'Recently, I asked for detailed scope and clear requirements before starting most assignments.', isReversed: true },
  { id: 5, dimension: 'COLLABORATION', text: 'Over the last several months, I resolved most work questions by calling or talking in person rather than writing.', isReversed: false },
  { id: 6, dimension: 'COLLABORATION', text: 'In the past year, I handled most coordination through written messages rather than meetings.', isReversed: true },
  { id: 7, dimension: 'DIRECTNESS', text: "In the last year, when a colleague's work fell short, I told them directly and immediately.", isReversed: false },
  { id: 8, dimension: 'DIRECTNESS', text: 'Over the past two years, I usually framed critical feedback gently and with a lot of context.', isReversed: true },
  { id: 9, dimension: 'OVERSIGHT', text: 'Over recent months, I checked on delegated tasks multiple times before they were finished.', isReversed: false },
  { id: 10, dimension: 'OVERSIGHT', text: 'In the past year, once I handed off work I generally left people alone until they came back with results.', isReversed: true },
  { id: 11, dimension: 'COMMITMENT', text: 'In the last several months, I worked beyond my normal hours whenever a deadline was at risk.', isReversed: false },
  { id: 12, dimension: 'COMMITMENT', text: 'Over the past year, I kept my work within set hours even when projects were running hot.', isReversed: true },
  { id: 13, dimension: 'RIGOR', text: 'Over recent months, I ran completed work through a checklist before submitting it.', isReversed: false },
  { id: 14, dimension: 'RIGOR', text: 'In the past year, I often moved forward without documenting the steps I took.', isReversed: true },
  { id: 15, dimension: 'VELOCITY', text: 'Over recent months, when two approaches both looked workable, I picked one and got moving rather than comparing them further.', isReversed: false },
  { id: 16, dimension: 'VELOCITY', text: 'In the past year, I held off starting until I was confident I had the right approach.', isReversed: true },
  { id: 17, dimension: 'DEFINITION', text: 'Over the past two years, I was often the one who designed the process others later followed.', isReversed: false },
  { id: 18, dimension: 'DEFINITION', text: 'Over the past year, I preferred picking up a defined plan and running it well over inventing the approach.', isReversed: true },
  { id: 19, dimension: 'COLLABORATION', text: 'Over the past months, I spent most of my working hours in shared sessions or alongside teammates.', isReversed: false },
  { id: 20, dimension: 'COLLABORATION', text: 'In the last year, I protected long uninterrupted blocks and worked through problems alone.', isReversed: true },
  { id: 21, dimension: 'DIRECTNESS', text: 'Over recent months, when I disagreed in a meeting, I stated my position plainly rather than softening it.', isReversed: false },
  { id: 22, dimension: 'DIRECTNESS', text: 'In the past year, I chose my moment carefully before raising a problem with someone.', isReversed: true },
  { id: 23, dimension: 'OVERSIGHT', text: 'Over the past year, when I delegated, I stayed close to the specific choices being made.', isReversed: false },
  { id: 24, dimension: 'OVERSIGHT', text: 'In the last several months, I set the outcome and left the method entirely to the person doing it.', isReversed: true },
  { id: 25, dimension: 'COMMITMENT', text: 'Over recent months, I stayed on a problem past normal hours until it was genuinely resolved.', isReversed: false },
  { id: 26, dimension: 'COMMITMENT', text: 'In the past year, I held my boundaries even when the team was under pressure.', isReversed: true },
  { id: 27, dimension: 'RIGOR', text: 'Over the past year, I proofread and double-checked my outputs before they left my hands.', isReversed: false },
  { id: 28, dimension: 'RIGOR', text: 'In the last several months, I shipped things knowing small errors would surface later.', isReversed: true },
  { id: 29, dimension: 'VELOCITY', text: 'Over the past year, I sent a rough first version early and refined it as feedback came in.', isReversed: false },
  { id: 30, dimension: 'VELOCITY', text: 'In the last several months, I preferred to finish something properly before showing it to anyone.', isReversed: true },
  { id: 31, dimension: 'DEFINITION', text: 'In the last several months, a vague assignment energized me more than a fully specified one.', isReversed: false },
  { id: 32, dimension: 'DEFINITION', text: 'Over recent months, when handed a proven template, I applied it as-is rather than reworking it.', isReversed: true },
  { id: 33, dimension: 'COLLABORATION', text: 'Over recent months, when something was unclear, my first move was to schedule a conversation.', isReversed: false },
  { id: 34, dimension: 'COLLABORATION', text: 'In the past year, I worked out my position on my own before bringing it to anyone.', isReversed: true },
  { id: 35, dimension: 'DIRECTNESS', text: 'Over the past year, I told people exactly where they stood without wrapping it in padding.', isReversed: false },
  { id: 36, dimension: 'DIRECTNESS', text: "In the last several months, I led with what was working before raising what wasn't.", isReversed: true },
  { id: 37, dimension: 'OVERSIGHT', text: 'Over recent months, I asked for frequent progress updates so I always knew where things stood.', isReversed: false },
  { id: 38, dimension: 'OVERSIGHT', text: 'In the past year, I trusted that work was on track unless someone told me otherwise.', isReversed: true },
  { id: 39, dimension: 'COMMITMENT', text: 'Over the past year, I rearranged my week around a deadline when the situation called for it.', isReversed: false },
  { id: 40, dimension: 'COMMITMENT', text: 'In the last several months, I let a deadline slip rather than give up my evenings.', isReversed: true },
  { id: 41, dimension: 'RIGOR', text: 'Over recent months, I documented each step as I went so the work could be traced.', isReversed: false },
  { id: 42, dimension: 'RIGOR', text: 'In the past year, I kept the details in my head rather than writing them down.', isReversed: true },
  { id: 43, dimension: 'VELOCITY', text: 'When priorities shifted mid-week over the past year, I dropped what I was doing and moved to the new thing.', isReversed: false },
  { id: 44, dimension: 'VELOCITY', text: 'Over recent months, I finished what was in front of me before taking on something newly urgent.', isReversed: true },
  { id: 45, dimension: 'DEFINITION', text: 'In the past year, I started building before the requirements were settled and let the details resolve as I went.', isReversed: false },
  { id: 46, dimension: 'DEFINITION', text: 'Over the past year, I waited for the brief to be clear before committing effort.', isReversed: true },
  { id: 47, dimension: 'COLLABORATION', text: 'Over the past year, I did my sharpest thinking with people around to react to.', isReversed: false },
  { id: 48, dimension: 'COLLABORATION', text: 'In the last several months, sustained time with the team left me needing to recover.', isReversed: true },
  { id: 49, dimension: 'DIRECTNESS', text: 'Over recent months, I named a problem bluntly so the team could move past it.', isReversed: false },
  { id: 50, dimension: 'DIRECTNESS', text: 'In the past year, I avoided direct confrontation where a quieter approach might work.', isReversed: true },
  { id: 51, dimension: 'OVERSIGHT', text: "Over the past year, I reviewed the details of a teammate's approach before they proceeded.", isReversed: false },
  { id: 52, dimension: 'OVERSIGHT', text: 'In the last several months, I deliberately stayed out of the day-to-day of work I had handed off.', isReversed: true },
  { id: 53, dimension: 'COMMITMENT', text: 'When a launch was at risk over the past year, I extended my day to match what the work needed.', isReversed: false },
  { id: 54, dimension: 'COMMITMENT', text: 'Over recent months, I treated my working hours as fixed regardless of what was happening.', isReversed: true },
  { id: 55, dimension: 'RIGOR', text: 'Over the past year, I built in checks to make sure deadlines were actually met.', isReversed: false },
  { id: 56, dimension: 'RIGOR', text: 'In the last several months, I stayed flexible with process rather than holding to a defined one.', isReversed: true },
]
