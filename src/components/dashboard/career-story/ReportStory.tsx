import Link from 'next/link'
import type { CareerStory } from '@/lib/career-story/load'
import { layoutStory } from '@/lib/career-story/layout'
import { parseIso } from '@/lib/career-story/events'
import { summarizeStory } from '@/lib/career-story/summary'
import { barClass } from './bar-style'

// The compact, read-only version for the Market Reality report. Same numbers as the full page.
export function ReportStory({ story }: { story: CareerStory }) {
  const now = parseIso(story.now)
  const layout = layoutStory(story.events, now, { hideYears: story.hideYears })
  return (
    <section className="space-y-4 rounded-lg border border-border p-4 print:break-inside-avoid" aria-labelledby="report-story-heading">
      <div className="space-y-1">
        <h2 id="report-story-heading" className="font-display text-xl font-semibold tracking-tight text-ink">
          Your career story
        </h2>
        <p className="text-sm text-muted-foreground">{summarizeStory(story.events, now)}</p>
      </div>
      <div className="flex" aria-hidden="true">
        <div className="w-20 shrink-0 pt-6 text-xs font-semibold text-muted-foreground">
          {layout.lanes.map((l) => (
            <div key={l.id} style={{ height: l.rows.length * 32 }} className="flex items-center">
              {l.label}
            </div>
          ))}
        </div>
        <div className="relative flex-1">
          <div className="relative h-6 text-xs text-muted-foreground">
            {layout.ticks.map((t, i) => (
              <span key={i} className="absolute" style={{ left: `${t.pct}%`, transform: i === 0 ? undefined : 'translateX(-50%)' }}>
                {t.label}
              </span>
            ))}
          </div>
          {layout.lanes.map((l) =>
            l.rows.map((row, ri) => (
              <div key={`${l.id}-${ri}`} className="relative" style={{ height: 32 }}>
                {row.map((bar) => {
                  const look = barClass(bar.event.kind, bar.ongoing)
                  return bar.point ? (
                    <span key={bar.event.id} className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-navy bg-white" style={{ left: `${bar.leftPct}%` }} />
                  ) : (
                    <span key={bar.event.id} className={`absolute inset-y-1 overflow-hidden whitespace-nowrap rounded-lg px-2 text-[10px] font-semibold leading-5 ${look.className}`} style={{ ...look.style, left: `${bar.leftPct}%`, width: `${bar.widthPct}%` }}>
                      {bar.widthPct > 6 ? bar.event.label : ''}
                    </span>
                  )
                })}
              </div>
            )),
          )}
          <span className="absolute inset-y-0 top-0 w-0.5 bg-light-blue" style={{ left: `${layout.todayPct}%` }} />
        </div>
      </div>
      <ul className="grid gap-3 sm:grid-cols-3">
        {story.main.map((d) => (
          <li key={d.id} className="space-y-1 rounded-lg border border-border p-3 text-sm">
            <p className="text-xs font-semibold text-muted-foreground">{d.tag}</p>
            <p className="font-semibold">{d.title}</p>
            <p className="text-xs text-muted-foreground">{d.cost ?? d.why}</p>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        A sketch from typical paths, not a prediction. Private to you.{' '}
        <Link href="/dashboard/my-career" className="text-primary underline underline-offset-4 print:hidden">
          Open your career story to change anything
        </Link>
      </p>
    </section>
  )
}
