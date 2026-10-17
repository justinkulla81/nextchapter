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

// The whole network on one screen: five circles from closest to widest, each with where it
// stands and one next step. Depth lives on each circle's own page.
export function NetworkOverview({ circles, headline }: { circles: CircleData[]; headline: string }) {
  return (
    <>
      <header className="space-y-1.5">
        <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight text-ink text-balance">Your network</h1>
        <p className="max-w-xl text-base text-muted-foreground">{headline}</p>
      </header>

      <div className="grid items-start gap-8 md:grid-cols-[18rem_1fr]">
        <Rings circles={circles} />
        <ol className="divide-y divide-border rounded-2xl border border-border">
          {circles.map((ci, i) => (
            <li key={ci.key} className="space-y-1 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-ink">
                  <span className="mr-2 text-muted-foreground tabular-nums">{i + 1}</span>
                  {ci.name}
                </h2>
                <span className={cn('inline-flex items-center gap-1 text-xs font-medium', ci.state === 'active' ? 'text-success' : 'text-muted-foreground')}>
                  {ci.state === 'active' && <Check className="size-3.5" aria-hidden />}
                  {ci.state === 'locked' && <Lock className="size-3.5" aria-hidden />}
                  {STATE_LABEL[ci.state]}
                </span>
              </div>
              <p className="text-base text-ink">{ci.status}</p>
              {ci.gap && <p className="text-sm text-muted-foreground">{ci.gap}</p>}
              <a href={ci.action.href} className="inline-block pt-1 text-sm font-medium text-brand underline underline-offset-4">
                {ci.action.label}
              </a>
            </li>
          ))}
        </ol>
      </div>

      <section aria-labelledby="week" className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-muted/60 p-5">
        <div className="space-y-0.5">
          <h2 id="week" className="font-display text-xl font-semibold text-ink">
            This week
          </h2>
          <p className="text-base text-muted-foreground">Five people to reach, drawn from across your circles, with what to ask each one.</p>
        </div>
        <a href="#" className="inline-flex h-11 items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95">
          Open this week&apos;s plan
        </a>
      </section>
    </>
  )
}
