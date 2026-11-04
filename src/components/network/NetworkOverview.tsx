import { Check, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

export type CircleState = 'active' | 'started' | 'empty' | 'locked'

export interface CircleData {
  key: string
  name: string
  /** One line saying where this circle stands. */
  status: string
  /** What is missing, said as a benefit, only when something is. */
  gap?: string
  state: CircleState
  action: { label: string; href: string }
  /** Progress toward something this circle opens, said as a bar with the reason it matters. */
  bars?: { label: string; pct: number; why: string }[]
}

const STATE_LABEL: Record<CircleState, string> = { active: 'Active', started: 'Started', empty: 'Not started', locked: 'Locked' }

export interface NextMove {
  title: string
  why: string
  /** A ready-to-send message, so starting takes one tap. Omitted when the draft is made on the next screen. */
  note?: string
  sendLabel: string
  /** Where the primary action goes. */
  href: string
}

export interface Moment {
  key: string
  title: string
  /** What happens when you get there, in one line. */
  payoff: string
  /** Where you are: "37 of 50". */
  progress: string
  /** 0 to 100. */
  pct: number
}

// The whole network on one screen, in two parts: your next move (how to build it) and your five circles from
// closest to widest (where support comes from), each with the progress that belongs to it. `after` is a quiet line below.
export function NetworkOverview({ circles, headline, next, after }: { circles: CircleData[]; headline: string; next: NextMove | null; after?: React.ReactNode }) {
  return (
    <>
      <header className="space-y-1.5">
        <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight text-ink text-balance">Your network</h1>
        <p className="max-w-xl text-base text-muted-foreground">{headline}</p>
      </header>

      {next && (
        <section aria-labelledby="next" className="space-y-3 rounded-2xl border border-border bg-white p-5">
          <h2 id="next" className="font-display text-2xl leading-tight font-semibold text-ink text-balance">{next.title}</h2>
          <p className="max-w-2xl text-base text-ink"><span className="font-semibold">Why:</span> {next.why}</p>
          {next.note && <blockquote className="max-w-2xl rounded-xl bg-muted/60 p-4 text-base text-ink">{next.note}</blockquote>}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <a href={next.href} className="inline-flex h-12 items-center rounded-full bg-action px-8 text-base font-semibold text-action-foreground hover:brightness-95">{next.sendLabel}</a>
            <a href="/dashboard/network/this-week" className="text-sm font-medium text-brand underline underline-offset-4">See this week&apos;s plan</a>
          </div>
        </section>
      )}

      <section aria-labelledby="circles" className="space-y-3">
        <h2 id="circles" className="font-display text-xl font-semibold text-ink">Your five circles</h2>
        <ol className="divide-y divide-border rounded-2xl border border-border">
          {circles.map((ci, i) => (
            <li key={ci.key} className="grid gap-x-6 gap-y-1 p-4 md:grid-cols-[1fr_auto]">
              <div className="space-y-0.5">
                <h3 className="flex flex-wrap items-center gap-x-3 text-base font-semibold text-ink">
                  <span><span className="mr-2 text-muted-foreground tabular-nums">{i + 1}</span>{ci.name}</span>
                  <span className={cn('inline-flex items-center gap-1 text-xs font-medium', ci.state === 'active' ? 'text-success' : 'text-muted-foreground')}>
                    {ci.state === 'active' && <Check className="size-3.5" aria-hidden />}
                    {ci.state === 'locked' && <Lock className="size-3.5" aria-hidden />}
                    {STATE_LABEL[ci.state]}
                  </span>
                </h3>
                <p className="text-base text-ink">{ci.status}</p>
                {ci.gap && <p className="text-sm text-muted-foreground">{ci.gap}</p>}
              </div>
              <div className="flex flex-col justify-center gap-1.5 md:w-64">
                {ci.bars?.map((b) => (
                  <div key={b.label} className="space-y-1">
                    <div className="h-1.5 overflow-hidden rounded-full bg-border" role="meter" aria-valuenow={b.pct} aria-valuemin={0} aria-valuemax={100} aria-label={b.label}>
                      <div className="h-full rounded-full bg-ink" style={{ width: `${b.pct}%` }} />
                    </div>
                    <p className="text-sm font-medium text-ink">{b.label}</p>
                    <p className="text-xs text-muted-foreground">{b.why}</p>
                  </div>
                ))}
                <a href={ci.action.href} className="text-sm font-medium text-brand underline underline-offset-4">{ci.action.label}</a>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {after}
    </>
  )
}
