import { Chip } from './ui'

// The first card on Home. It names the member's journey, shows the few facts that shape their plan,
// and says plainly what that changes. Each fact has exactly one place it is edited, so this card links
// there and never asks the same question again.
export function JourneyCard({ journey, since, facts, changes, switchLabel }: { journey: string; since: string; facts: { label: string; value: string }[]; changes: string[]; switchLabel?: string }) {
  return (
    <section aria-label="Your journey" className="space-y-4 rounded-2xl border border-border bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Your journey</p>
          <h2 className="font-display text-2xl font-semibold text-ink">{journey}</h2>
          <p className="text-sm text-muted-foreground">{since}</p>
        </div>
        <a href="#" className="text-sm font-medium text-brand underline underline-offset-4">Change my journey</a>
      </div>
      <dl className="grid gap-3 sm:grid-cols-3">
        {facts.map((f) => (
          <div key={f.label} className="rounded-xl bg-muted/60 px-4 py-3">
            <dt className="text-xs text-muted-foreground">{f.label}</dt>
            <dd className="text-base font-semibold text-ink">{f.value}</dd>
          </div>
        ))}
      </dl>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-ink">What this changes for you</p>
        <ul className="space-y-1 text-sm text-ink">
          {changes.map((c) => <li key={c} className="flex gap-2"><Chip tone="good">On</Chip><span>{c}</span></li>)}
        </ul>
      </div>
      {switchLabel && <a href="#" className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted">{switchLabel}</a>}
    </section>
  )
}
