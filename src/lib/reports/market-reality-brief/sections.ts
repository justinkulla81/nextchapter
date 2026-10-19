// The report's sections, in reading order. One list drives the contents page,
// every section's number and every "see section NN" reference, so they can
// never disagree after a section is added or moved.

export const SECTIONS = [
  { id: 'read', title: 'How you will be read' },
  { id: 'case', title: 'The case for you' },
  { id: 'objections', title: 'Likely objections and your answers' },
  { id: 'profile', title: 'Competency profile' },
  { id: 'basis', title: 'Basis of assessment' },
  { id: 'market', title: 'Market' },
  { id: 'requirements', title: 'Search requirements' },
  { id: 'experience', title: 'Experience' },
  { id: 'skills', title: 'Skills' },
  { id: 'resume', title: 'Resume' },
  { id: 'direction', title: 'Direction' },
  { id: 'activity', title: 'Search activity to date' },
  { id: 'start', title: 'Start here: your first twelve weeks' },
] as const

export type SectionId = (typeof SECTIONS)[number]['id']

export function sectionNumber(id: SectionId): string {
  return String(SECTIONS.findIndex((s) => s.id === id) + 1).padStart(2, '0')
}
