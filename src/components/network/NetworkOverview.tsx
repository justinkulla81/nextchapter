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
}

// Rings from the centre outward: the people closest to you first, the market last.
const RING_STYLE: Record<CircleState, string> = {
  active: 'fill-ink/15 stroke-ink',
  started: 'fill-ink/8 stroke-ink/60',
  empty: 'fill-transparent stroke-border',
  locked: 'fill-transparent stroke-border [stroke-dasharray:4_4]',
}

function Rings({ circles }: { circles: CircleData[] }) {
  const size = 300
  const c = size / 2
  const step = 26
  const outer = c - 4
  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Your network, from closest to widest: ${circles.map((x) => x.name).join(', ')}`} className="mx-auto w-full max-w-xs">
      {[...circles].reverse().map((ci, i) => {
        const r = outer - i * step
        return <circle key={ci.key} cx={c} cy={c} r={r} strokeWidth={1.5} className={RING_STYLE[ci.state]} />
      })}
      <circle cx={c} cy={c} r={outer - (circles.length - 1) * step - 6} className="fill-ink" />
      <text x={c} y={c + 5} textAnchor="middle" className="fill-white text-[13px] font-semibold">
        You
      </text>
    </svg>
  )
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

// The whole network on one screen, in three parts: your next move (how to build it), your five
// circles from closest to widest (where support comes from), and the moments you are working toward.
export function NetworkOverview({ circles, headline, next, moments }: { circles: CircleData[]; headline: string; next: NextMove | null; moments: Moment[] }) {
  return (
    <>
      <header className="space-y-1.5">
        <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight text-ink text-balance">Your network</h1>
        <p className="max-w-xl text-base text-muted-foreground">{headline}</p>
      </header>

      {next && (
        <section aria-labelledby="next" className="space-y-4 rounded-2xl border border-border bg-white p-7">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Your next move</p>
          <h2 id="next" className="font-display text-2xl leading-tight font-semibold text-ink text-balance">{next.title}</h2>
          <p className="max-w-2xl text-base text-ink"><span className="font-semibold">Why:</span> {next.why}</p>
          {next.note && <blockquote className="max-w-2xl rounded-xl bg-muted/60 p-4 text-base text-ink">{next.note}</blockquote>}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <a href={next.href} className="inline-flex h-12 items-center rounded-full bg-action px-8 text-base font-semibold text-action-foreground hover:brightness-95">{next.sendLabel}</a>
            <a href="/dashboard/network/this-week" className="text-sm font-medium text-brand underline underline-offset-4">See this week&apos;s plan</a>
          </div>
        </section>
      )}

      <section aria-labelledby="circles" className="space-y-4">
        <h2 id="circles" className="font-display text-xl font-semibold text-ink">Your five circles</h2>
        <div className="grid items-start gap-8 md:grid-cols-[16rem_1fr]">
          <Rings circles={circles} />
          <ol className="divide-y divide-border rounded-2xl border border-border">
            {circles.map((ci, i) => (
              <li key={ci.key} className="space-y-0.5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-ink">
                    <span className="mr-2 text-muted-foreground tabular-nums">{i + 1}</span>
                    {ci.name}
                  </h3>
                  <span className={cn('inline-flex items-center gap-1 text-xs font-medium', ci.state === 'active' ? 'text-success' : 'text-muted-foreground')}>
                    {ci.state === 'active' && <Check className="size-3.5" aria-hidden />}
                    {ci.state === 'locked' && <Lock className="size-3.5" aria-hidden />}
                    {STATE_LABEL[ci.state]}
                  </span>
                </div>
                <p className="text-base text-ink">{ci.status}</p>
                {ci.gap && <p className="text-sm text-muted-foreground">{ci.gap}</p>}
                <a href={ci.action.href} className="inline-block pt-1 text-sm font-medium text-brand underline underline-offset-4">{ci.action.label}</a>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {moments.length > 0 && (
      <section aria-labelledby="moments" className="space-y-4">
        <h2 id="moments" className="font-display text-xl font-semibold text-ink">Moments you are working toward</h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {moments.map((m) => (
            <li key={m.key} className="space-y-3 rounded-2xl border border-border p-5">
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-ink">{m.title}</h3>
                <p className="text-sm text-muted-foreground">{m.payoff}</p>
              </div>
              <div className="space-y-1.5">
                <div className="h-1.5 overflow-hidden rounded-full bg-border" role="meter" aria-valuenow={m.pct} aria-valuemin={0} aria-valuemax={100} aria-label={m.title}>
                  <div className="h-full rounded-full bg-ink" style={{ width: `${m.pct}%` }} />
                </div>
                <p className="text-sm font-medium text-ink">{m.progress}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
      )}
    </>
  )
}
