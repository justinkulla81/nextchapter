// Pure data and helpers, no database import: the client table needs ORG_SEGMENTS, and a client bundle must never pull in prisma
// (PrismaClient throws in the browser and the page shows "This page didn't load"). The query lives in org-segments.ts.
// The kinds of organization the owner sorts a mailing by. One person can fall in more than one (a university that runs a
// workforce program), so the filter asks "is any of their organizations of this kind".
export const ORG_SEGMENTS = [
  { key: 'higher_ed', label: 'Higher ed', types: ['UNIVERSITY'] },
  { key: 'workforce', label: 'Workforce', types: ['WORKFORCE_PROVIDER'] },
  { key: 'employer', label: 'Employer', types: ['EMPLOYER', 'OUTPLACEMENT_LEAD'] },
  { key: 'research', label: 'Research and academic', types: ['THINK_TANK'] },
  { key: 'funder', label: 'VC and funder', types: ['VC_FUND', 'ANGEL_SYNDICATE', 'FUNDER_GRANT', 'FOUNDATION', 'ACCELERATOR'] },
  { key: 'service', label: 'Recruiter, coach and vendor', types: ['SEARCH_FIRM', 'COACHING_FIRM', 'OUTPLACEMENT_FIRM', 'VENDOR'] },
  { key: 'government', label: 'Government', types: ['GOVERNMENT'] },
  { key: 'nonprofit_media', label: 'Nonprofit and media', types: ['NONPROFIT', 'MEDIA'] },
] as const

export type OrgSegmentKey = (typeof ORG_SEGMENTS)[number]['key']

/** Same test the mailing lists use to spot a workforce board by its name. */
const WORKFORCE_NAME = /\bworkforce\b|careersource|american job center|job center/i

export function segmentsFor(org: { name: string; orgTypes: string[] }): OrgSegmentKey[] {
  const out = new Set<OrgSegmentKey>()
  for (const s of ORG_SEGMENTS) if (s.types.some((t) => org.orgTypes.includes(t))) out.add(s.key)
  if (WORKFORCE_NAME.test(org.name)) out.add('workforce')
  return [...out]
}
