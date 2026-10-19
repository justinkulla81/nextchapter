import Link from 'next/link'
import { cn } from '@/lib/utils'
import { boardHref } from '@/lib/jobs/board-url'

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

export function FindParts({ current, independent, urlParams }: { current: FindPart; independent: boolean; urlParams: Record<string, string> }) {
  return (
    <nav aria-label="Find a job parts" className="flex flex-wrap gap-2">
      {FIND_PARTS.filter((p) => p.key !== 'independent' || independent).map((p) => (
        <Link
          key={p.key}
          href={boardHref(urlParams, { part: p.key === 'jobs' ? undefined : p.key })}
          aria-current={current === p.key ? 'page' : undefined}
          className={cn('rounded-full border px-4 py-1.5 text-sm font-medium', current === p.key ? 'border-ink bg-ink text-white' : 'border-border text-muted-foreground hover:text-ink')}
        >
          {p.label}
        </Link>
      ))}
    </nav>
  )
}
