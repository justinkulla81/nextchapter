import type { StoryEvent } from '@/lib/career-story/events'
import { LANES, whenText } from '@/lib/career-story/layout'
import { cn } from '@/lib/utils'
import { barClass } from './bar-style'

// The same story as a list, newest first. This is the phone view and the screen-reader view: it
// holds exactly what the picture holds.
export function StoryList({ events, now, hideYears, selectedId, onSelect }: { events: StoryEvent[]; now: Date; hideYears: boolean; selectedId: string | null; onSelect: (id: string) => void }) {
  const ordered = [...events].sort((a, b) => b.start.localeCompare(a.start))
  return (
    <ol className="space-y-2" aria-label="Your career story, newest first">
      {ordered.map((e) => {
        const look = barClass(e.kind, e.end === null)
        const lane = LANES.find((l) => l.kinds.includes(e.kind))?.label ?? ''
        return (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => onSelect(e.id)}
              aria-pressed={selectedId === e.id}
              className={cn('flex w-full items-start gap-3 rounded-lg border border-border bg-card p-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50', selectedId === e.id && 'border-light-blue')}
            >
              <span aria-hidden="true" className={cn('mt-1 h-8 w-1.5 shrink-0 rounded-full', look.className)} style={look.style} />
              <span className="min-w-0 space-y-0.5">
                <span className="block text-sm font-semibold text-foreground">{e.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {lane} · {whenText(e, now, hideYears)}
                  {e.unlabeled ? ' · Tell us what happened if you like' : ''}
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
