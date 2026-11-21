// One alum's journey with the college, newest first, each step with the office that acted. Pure: the dev preview renders it.

import type { JourneyItem } from '@/lib/higher-ed/member-journey'

const DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

export function MemberJourneyView({ name, classYear, items }: { name: string; classYear: number | null; items: JourneyItem[] }) {
  return (
    <section aria-labelledby="journey-h" className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div>
        <h2 id="journey-h" className="text-base font-semibold">
          {name}
          {classYear ? ` ’${String(classYear).slice(-2)}` : ''}: their journey with the college
        </h2>
        <p className="text-sm text-muted-foreground">Newest first. Details they chose not to share stay hidden.</p>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing yet beyond the roster.</p>
      ) : (
        <ol className="relative space-y-3 border-l border-border pl-5">
          {items.map((it, i) => (
            <li key={`${it.at.toISOString()}-${i}`} className="relative">
              <span className="absolute top-1.5 -left-[1.4rem] size-2.5 rounded-full bg-primary" aria-hidden="true" />
              <p className="text-sm">{it.what}</p>
              <p className="text-xs text-muted-foreground">
                {DATE.format(it.at)} · {it.office}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
