import Link from 'next/link'
import { Meter } from './ui'

// The first thing on Home, Jobs, Network and Learn. It says what is not tuned yet, what answering gets the
// member, and why. One line and one control. When everything is tuned it shrinks to a quiet "Tuned" line.
export interface TuneAsk {
  /** What we would ask, as a plain request. */
  ask: string
  /** What the member gets for answering. */
  gain: string
}

export function TuneStrip({ title, pct, because, asks, actionLabel = 'Improve this', actionHref = '#', tunedNote }: { title: string; pct: number; because: string; asks?: TuneAsk[]; actionLabel?: string; actionHref?: string; tunedNote?: string }) {
  if (pct >= 100) {
    return (
      <p className="flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
        <span className="font-semibold text-ink">{title}: tuned.</span>
        <span>{tunedNote}</span>
        <Link href={actionHref} className="font-medium text-brand underline underline-offset-4">Change</Link>
      </p>
    )
  }
  return (
    <section aria-label={title} className="space-y-3 rounded-2xl bg-muted/60 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
        <div className="min-w-0 flex-1 basis-80 space-y-1.5">
          <p className="text-base font-semibold text-ink">{title}</p>
          <p className="text-sm text-ink">{because}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-28"><Meter pct={pct} label={`${title} tuned`} /></div>
          <span className="text-sm font-semibold text-ink tabular-nums">{pct}%</span>
          <Link href={actionHref} className="inline-flex h-10 items-center rounded-full bg-ink px-5 text-sm font-semibold text-white hover:opacity-90">{actionLabel}</Link>
        </div>
      </div>
      {asks && (
        <ul className="grid gap-x-8 gap-y-1.5 border-t border-border pt-3 text-sm sm:grid-cols-2">
          {asks.map((a) => (
            <li key={a.ask} className="text-ink"><span className="font-semibold">{a.ask}</span> <span className="text-muted-foreground">{a.gain}</span></li>
          ))}
        </ul>
      )}
    </section>
  )
}
