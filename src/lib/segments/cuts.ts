// The lists every segment gets, and the words around them. Pure: headings, the plain sentence under each, and the method note
// are rules over the stored numbers (no AI), unit-tested in src/test/segments.test.ts.

import type { SegmentDef } from '@/lib/segments/defs'
import type { CutId, SegmentEdition, SegmentRow } from '@/lib/segments/types'
import { count, usdK } from '@/lib/segments/aggregate'

export interface CutDef {
  id: CutId
  /** The address part: /jobs/industry/<segment>/<id>. */
  short: string
  /** Column heading for the ranked value. */
  valueHead: string
  /** Names the thing being ranked, for the column heading. */
  nounHead: string
  title: (d: SegmentDef) => string
}

export const CUTS: CutDef[] = [
  { id: 'top-employers', short: 'Most openings', valueHead: 'Open jobs', nounHead: 'Employer', title: (d) => `Employers with the most open ${d.label} jobs` },
  { id: 'top-roles', short: 'Most in demand', valueHead: 'Open jobs', nounHead: 'Role', title: (d) => `Most in-demand ${d.label} roles` },
  { id: 'highest-paying-roles', short: 'Highest-paying roles', valueHead: 'Median pay', nounHead: 'Role', title: (d) => `Highest-paying ${d.label} roles` },
  { id: 'highest-paying-employers', short: 'Highest-paying employers', valueHead: 'Median pay', nounHead: 'Employer', title: (d) => `Highest-paying ${d.label} employers` },
  { id: 'top-skills', short: 'Skills in demand', valueHead: 'Share of jobs', nounHead: 'Skill', title: (d) => `Skills employers ask for in ${d.label} jobs` },
  { id: 'top-states', short: 'Top states', valueHead: 'Open jobs', nounHead: 'State', title: (d) => `States with the most ${d.label} jobs` },
  { id: 'top-cities', short: 'Top cities', valueHead: 'Open jobs', nounHead: 'City', title: (d) => `Cities with the most ${d.label} jobs` },
  { id: 'entry-level', short: 'Entry-level', valueHead: 'Entry-level jobs', nounHead: 'Employer', title: (d) => `Entry-level ${d.label} jobs and who is hiring` },
  { id: 'newest', short: 'New this week', valueHead: '', nounHead: '', title: (d) => `New ${d.label} jobs this week` },
]

export const cutById = (id: string): CutDef | null => CUTS.find((c) => c.id === id) ?? null
export const cutPath = (segment: string, cut: CutId) => `/jobs/industry/${segment}/${cut}`
export const segmentPath = (segment: string) => `/jobs/industry/${segment}`

const list = (names: string[]) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`)
const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0)

/** One or two plain sentences that read the list's own numbers. */
export function cutSentence(d: SegmentDef, cut: CutId, e: SegmentEdition): string {
  const rows: SegmentRow[] = e.cuts[cut] ?? []
  const top = rows.slice(0, 3).map((r) => r.name)
  switch (cut) {
    case 'top-employers': {
      const share = pct(rows.slice(0, 10).reduce((n, r) => n + r.value, 0), e.total)
      return `${list(top)} lead the ${d.label} employers on our board. The ten with the most openings post ${share}% of the ${count(e.total)} open ${d.label} jobs.`
    }
    case 'top-roles':
      return `${list(top)} are the roles ${d.label} employers have the most openings for, out of ${count(e.total)} open jobs.`
    case 'highest-paying-roles':
      return `Among ${d.label} jobs that state yearly pay, ${list(top)} pay the most at the median${e.payMed ? `, against ${usdK(e.payMed)} for the segment as a whole` : ''}.`
    case 'highest-paying-employers':
      return `${list(top)} post the highest median pay among ${d.label} employers that state pay on at least a few of their jobs.`
    case 'top-skills':
      return `${list(top)} are the skills most often named in ${d.label} job postings, read from each posting's own text.`
    case 'top-states':
      return `${list(top)} have the most open ${d.label} jobs.`
    case 'top-cities':
      return `${list(top)} have the most open ${d.label} jobs among cities where no single employer posts half of them.`
    case 'entry-level':
      return `${count(e.entry.total)} of the ${count(e.total)} open ${d.label} jobs are entry-level or say no experience is needed${top.length ? `. ${list(top)} are hiring the most of them` : ''}.`
    case 'newest':
      return `${count(e.newest.length)} ${d.label} jobs were posted in the last seven days.`
  }
}

/** The change since last month, in a clause, or '' when there is no earlier edition. */
export function changeClause(e: SegmentEdition): string {
  if (!e.prev || !e.prev.total) return ''
  const delta = e.total - e.prev.total
  if (delta === 0) return 'The same number of open jobs as last month.'
  return `${count(Math.abs(delta))} ${delta > 0 ? 'more' : 'fewer'} open jobs than last month (${pct(Math.abs(delta), e.prev.total)}%).`
}

export const AMERICA_NOTE = 'Every job on this page is in the United States, taken from the employer’s own career site or job system and checked to still be open.'

export function methodNotes(d: SegmentDef): string[] {
  return [
    AMERICA_NOTE,
    `A job is counted in ${d.label} when its employer is on our list of ${d.label} employers, or its title names ${d.label} work. A job can sit in more than one segment.`,
    'Pay figures use only jobs that state a yearly salary range in dollars; the figure is the middle of the range, and the median is across jobs. A pay list is shown only when enough jobs state pay.',
    'The same employer under different spellings is counted once. A city where one employer posts half the openings is not ranked.',
    'Lists are rebuilt weekly from our job board and kept by month. Professional and management roles; hourly roles are not on our board.',
  ]
}
