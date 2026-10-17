'use client'

import { saveExploredTarget } from '@/app/dashboard/pivot-paths/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { Button } from '@/components/ui/button'
import { DOOR_SCALE_MONTHS, type Door } from '@/lib/career-story/doors'
import { cn } from '@/lib/utils'

const TONE: Record<Door['tagTone'], string> = {
  green: 'bg-[#e3f0e9] text-[#1f5a41]',
  blue: 'bg-[#eaf2fb] text-navy',
  warm: 'bg-[#fdeedd] text-[#5b3300]',
  neutral: 'bg-muted text-foreground',
}

function monthsText(from: number, to: number) {
  const f = Math.round(from)
  const t = Math.round(to)
  return f === t ? `month ${f}` : `months ${f} to ${t}`
}

// The shape of a door over three years: a solid stretch where it is usually under way, a lighter
// stretch for the range, because it varies. The list under it says the same in words.
function PhaseBar({ door }: { door: Door }) {
  return (
    <div className="space-y-1.5">
      <div className="relative h-5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        {door.phases.map((p) => (
          <span key={p.label}>
            <span className="absolute inset-y-1 rounded-full bg-light-blue" style={{ left: `${(p.from / DOOR_SCALE_MONTHS) * 100}%`, width: `${((p.solidTo - p.from) / DOOR_SCALE_MONTHS) * 100}%` }} />
            <span
              className="absolute inset-y-1 rounded-full opacity-60"
              style={{
                left: `${(p.solidTo / DOOR_SCALE_MONTHS) * 100}%`,
                width: `${((p.rangeTo - p.solidTo) / DOOR_SCALE_MONTHS) * 100}%`,
                background: 'repeating-linear-gradient(135deg,#2980d4 0 3px,transparent 3px 6px)',
              }}
            />
          </span>
        ))}
      </div>
      <ul className="space-y-0.5 text-xs text-muted-foreground">
        {door.phases.map((p) => (
          <li key={p.label}>
            <span className="font-medium text-foreground">{p.label}:</span> usually {monthsText(p.from, p.solidTo)}, sometimes up to month {Math.round(p.rangeTo)}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function DoorCard({ door, onTryPause }: { door: Door; onTryPause?: () => void }) {
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4" aria-labelledby={`door-${door.id}`}>
      <span className={cn('self-start rounded-full px-2.5 py-0.5 text-[11px] font-semibold', TONE[door.tagTone])}>{door.tag}</span>
      <h3 id={`door-${door.id}`} className="text-base font-semibold text-foreground">
        {door.title}
      </h3>
      <p className="text-sm text-muted-foreground">{door.why}</p>
      <PhaseBar door={door} />
      {door.cost && <p className="text-xs text-muted-foreground">{door.cost}</p>}
      {door.opens.length > 0 && <p className="text-xs text-muted-foreground">Could lead to: {door.opens.slice(0, 3).join(', ')}</p>}
      <p className="mt-auto text-sm text-foreground">
        <strong className="font-semibold">First step:</strong> {door.firstStep}
      </p>
      <div className="flex flex-wrap gap-2">
        {door.radarFunction && !door.onRadar && (
          <form action={saveExploredTarget}>
            <input type="hidden" name="target" value={door.radarFunction} />
            <SubmitButton size="sm" variant="outline" pendingLabel="Adding…" savedLabel="On your radar">
              Put {door.radarFunction} on my radar
            </SubmitButton>
          </form>
        )}
        {door.onRadar && <span className="text-xs text-muted-foreground">On your radar</span>}
        {door.kind === 'PAUSE' && onTryPause && (
          <Button type="button" size="sm" variant="outline" onClick={onTryPause}>
            Try it on
          </Button>
        )}
      </div>
    </article>
  )
}

export function DoorsSection({ main, more, onTryPause }: { main: Door[]; more: Door[]; onTryPause: () => void }) {
  return (
    <section className="space-y-4" aria-labelledby="doors-heading">
      <div className="space-y-1">
        <h2 id="doors-heading" className="text-lg font-semibold tracking-tight">
          Doors you could open
        </h2>
        <p className="text-sm text-muted-foreground">Looking is free. Time and cost are ranges from typical paths, not promises, and nothing here changes your search until you say so.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {main.map((d) => (
          <DoorCard key={d.id} door={d} />
        ))}
      </div>
      <details className="rounded-2xl border border-border bg-card p-4">
        <summary className="cursor-pointer text-sm font-semibold text-foreground">More doors: your own practice, school, a new place, a pause</summary>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {more.map((d) => (
            <DoorCard key={d.id} door={d} onTryPause={onTryPause} />
          ))}
        </div>
      </details>
    </section>
  )
}
