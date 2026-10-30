export type JobSourceKind = 'Direct' | 'Jooble' | 'Adzuna' | 'USAJobs' | 'Other aggregator'

export const JOB_SOURCE_KINDS: JobSourceKind[] = ['Direct', 'Jooble', 'Adzuna', 'USAJobs', 'Other aggregator']

// Where a job's Apply link sends the visitor. Named aggregators are told apart
// by apply-link host; any other board the crawler tags as an aggregator is
// lumped together, and everything else is the employer's or a recruiter's own page.
export function classifyJobSource(url: string | null, sourceCategory: string | null): JobSourceKind {
  const u = (url ?? '').toLowerCase()
  if (u.includes('jooble.org')) return 'Jooble'
  if (u.includes('adzuna.')) return 'Adzuna'
  if (u.includes('usajobs.gov')) return 'USAJobs'
  if (sourceCategory === 'aggregator') return 'Other aggregator'
  return 'Direct'
}
