'use client'

import type { Layout } from '@/lib/career-story/layout'
import { whenText } from '@/lib/career-story/layout'
import { parseIso } from '@/lib/career-story/events'
import { cn } from '@/lib/utils'
import { barClass } from './bar-style'

const ROW_H = 40

// The picture: one lane per kind of chapter, time running left to right, today marked, and open
// space to the right for what comes next. Every bar is a button; the list view carries the same
// content for screen readers and phones.
export function StoryTimeline({
  layout,
  now,
  hideYears,
  selectedId,
  onSelect,
  ghostMonths,
}: {
  layout: Layout
  now: Date
  hideYears: boolean
  selectedId: string | null
  onSelect: (id: string) => void
  ghostMonths: number
}) {
  const span = layout.endYear - layout.startYear
  const ghostWidth = Math.min(100 - layout.todayPct, (ghostMonths / 12 / span) * 100)
  const nowIso = now.toISOString().slice(0, 10)
  return (
    <div className="flex" role="group" aria-label="Your career timeline. Each chapter is a button that opens its details.">
      <div className="w-24 shrink-0 pt-8 text-xs font-semibold text-muted-foreground sm:w-28">
        {layout.lanes.map((lane) => (
          <div key={lane.id} style={{ height: lane.rows.length * ROW_H }} className="flex items-center">
            {lane.label}
          </div>
        ))}
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="relative h-8 text-xs font-medium text-muted-foreground" aria-hidden="true">
          {layout.ticks.map((t, i) => (
            <span key={i} className="absolute" style={{ left: `${t.pct}%`, transform: i === 0 ? undefined : 'translateX(-50%)' }}>
              {t.label}
            </span>
          ))}
        </div>
        <div className="relative">
          <span
            aria-hidden="true"
            className="absolute inset-y-0 right-0 motion-safe:transition-opacity"
            style={{ left: `${layout.todayPct}%`, background: 'linear-gradient(90deg,rgba(41,128,212,.12),rgba(41,128,212,0))' }}
          />
          {layout.lanes.map((lane) =>
            lane.rows.map((row, ri) => (
              <div key={`${lane.id}-${ri}`} className="relative" style={{ height: ROW_H }}>
                {lane.id === 'pauses' && ri === 0 && ghostMonths > 0 && (
                  <span
                    aria-label={`If you paused for ${ghostMonths} months, it would look like this`}
                    role="img"
                    className="absolute inset-y-1.5 rounded-xl border border-dashed border-light-blue bg-light-blue/10"
                    style={{ left: `${layout.todayPct}%`, width: `${ghostWidth}%` }}
                  />
                )}
                {row.map((bar) => {
                  const e = bar.event
                  const look = barClass(e.kind, bar.ongoing)
                  const selected = selectedId === e.id
                  const label = `${e.title}, ${whenText(e, now, hideYears)}`
                  if (bar.point) {
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => onSelect(e.id)}
                        aria-label={label}
                        aria-pressed={selected}
                        title={label}
                        className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                        style={{ left: `${bar.leftPct}%` }}
                      >
                        <span
                          aria-hidden="true"
                          className={cn('block size-4 border-4 border-navy bg-white', e.kind === 'MILESTONE' ? 'rotate-45 rounded-[3px]' : 'rounded-full', selected && 'ring-2 ring-light-blue')}
                        />
                      </button>
                    )
                  }
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => onSelect(e.id)}
                      aria-label={label}
                      aria-pressed={selected}
                      title={label}
                      className={cn(
                        'absolute inset-y-1.5 flex items-center overflow-hidden whitespace-nowrap rounded-xl px-2.5 text-left text-[11px] font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-safe:transition-shadow',
                        look.className,
                        selected && 'ring-2 ring-light-blue ring-offset-1',
                        e.unlabeled && 'italic',
                      )}
                      style={{ ...look.style, left: `${bar.leftPct}%`, width: `${bar.widthPct}%` }}
                    >
                      {bar.widthPct > 8 ? e.label : ''}
                    </button>
                  )
                })}
              </div>
            )),
          )}
          <span aria-hidden="true" className="pointer-events-none absolute -bottom-0.5 -top-1.5 w-0.5 bg-light-blue" style={{ left: `${layout.todayPct}%` }} />
          <span
            aria-label={`Today, ${nowIso}`}
            className="absolute -top-8 -translate-x-1/2 rounded-full bg-light-blue px-2.5 py-0.5 text-[11px] font-bold text-white shadow-[0_0_0_4px_rgba(41,128,212,.2)]"
            style={{ left: `${layout.todayPct}%` }}
          >
            Today
          </span>
          {ghostMonths > 0 && <span className="sr-only">Showing a {ghostMonths}-month pause starting today, as a try-on only.</span>}
        </div>
        <p className="sr-only">{parseIso(nowIso).getUTCFullYear()}</p>
      </div>
    </div>
  )
}
