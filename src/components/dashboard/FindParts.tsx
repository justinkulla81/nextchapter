import Link from 'next/link'
import { cn } from '@/lib/utils'
import { boardHref } from '@/lib/jobs/board-url'
import { TrackedLink } from '@/components/dashboard/TrackedLink'

// The parts of Find a job in the redesign: one view at a time, so the page never becomes one long run of sections.
export const FIND_PARTS = [
  { key: 'jobs', label: 'Jobs' },
  { key: 'unposted', label: 'Not posted yet' },
  { key: 'independent', label: 'Independent work' },
  { key: 'resources', label: 'Resources' },
] as const
export type FindPart = (typeof FIND_PARTS)[number]['key']

export function parseFindPart(v: string | undefined): FindPart {
  return FIND_PARTS.find((p) => p.key === v)?.key ?? 'jobs'
}

const PILL = 'rounded-full border px-4 py-1.5 text-sm font-medium'
const PILL_ON = 'border-ink bg-ink text-white'
const PILL_OFF = 'border-border text-muted-foreground hover:text-ink'

/**
 * The one tab row on Find a job: the parts, then My jobs. Job board / My jobs used to be a second tab row under the menu;
 * `current` is null while My jobs is open. The parts always link back to the board.
 */
export function FindParts({
  current,
  independent,
  urlParams,
  myJobs,
}: {
  current: FindPart | null
  independent: boolean
  urlParams: Record<string, string>
  myJobs?: { count: number; current: boolean }
}) {
  return (
    <nav aria-label="Find a job" className="flex flex-wrap gap-2">
      {FIND_PARTS.filter((p) => p.key !== 'independent' || independent).map((p) => (
        <Link
          key={p.key}
          href={boardHref(urlParams, { part: p.key === 'jobs' ? undefined : p.key, job: null, tab: 'board' })}
          aria-current={current === p.key ? 'page' : undefined}
          className={cn(PILL, current === p.key ? PILL_ON : PILL_OFF)}
        >
          {p.label}
        </Link>
      ))}
      {myJobs && (
        <TrackedLink
          href={boardHref(urlParams, { tab: 'my_jobs', part: null, job: null })}
          event="job_board_tab_changed"
          properties={{ tab: 'my_jobs' }}
          className={cn(PILL, myJobs.current ? PILL_ON : PILL_OFF)}
        >
          {myJobs.count > 0 ? `My jobs (${myJobs.count})` : 'My jobs'}
        </TrackedLink>
      )}
    </nav>
  )
}
