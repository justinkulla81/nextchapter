// The report's sections, in reading order. One list drives the contents page,
// every section's number and every "see section NN" reference, so they can
// never disagree after a section is added or moved.
//
// The body is the decision-making part (about eight pages): why an employer
// would hire you, how you will be read, the market, the plan. The appendix
// holds the supporting detail, lettered so a reference to it never collides
// with a body number.

export const BODY_SECTIONS = [
  { id: 'hire', title: 'Reasons an employer would hire you' },
  { id: 'read', title: 'How you will be read' },
  { id: 'objections', title: 'Likely objections and your answers' },
  { id: 'market', title: 'Market' },
  { id: 'requirements', title: 'Search requirements' },
  { id: 'direction', title: 'Direction' },
  { id: 'start', title: 'Start here: your first twelve weeks' },
] as const

export const APPENDIX_SECTIONS = [
  { id: 'basis', title: 'Basis of assessment' },
  { id: 'profile', title: 'Competency profile' },
  { id: 'experience', title: 'Experience in detail' },
  { id: 'skills', title: 'Skills in detail' },
  { id: 'resume', title: 'Resume in detail' },
  { id: 'activity', title: 'Search activity to date' },
  { id: 'rubric', title: 'How ratings are set' },
] as const

export const SECTIONS = [...BODY_SECTIONS, ...APPENDIX_SECTIONS] as const

export type SectionId = (typeof SECTIONS)[number]['id']

/** "01".."07" for the body, "A".."F" for the appendix. */
export function sectionNumber(id: SectionId): string {
  const body = BODY_SECTIONS.findIndex((s) => s.id === id)
  if (body >= 0) return String(body + 1).padStart(2, '0')
  const app = APPENDIX_SECTIONS.findIndex((s) => s.id === id)
  return String.fromCharCode(65 + app)
}
