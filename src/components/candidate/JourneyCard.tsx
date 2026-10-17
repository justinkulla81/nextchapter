import { Chip } from './ui'

// The first card on Home. It names the member's journey, shows the few facts that shape their plan,
// and says plainly what that changes. Each fact has exactly one place it is edited, so this card links
// there and never asks the same question again.
export function JourneyCard({ journey, since, facts, changes, switchLabel, tune }: { journey: string; since: string; facts: { label: string; value: string }[]; changes: string[]; switchLabel?: string; tune?: { text: string; action: string } }) {
  return (
    <section aria-label="Your journey" className="space-y-3 rounded-2xl border border-border bg-white p-4 sm:space-y-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Your journey</p>
          <h2 className="font-display text-xl font-semibold text-ink sm:text-2xl">{journey}</h2>
          <p className="text-sm text-muted-foreground">{since}</p>
        </div>
        <a href="#" className="shrink-0 text-sm font-medium text-brand underline underline-offset-4"><span className="sm:hidden">Change</span><span className="hidden sm:inline">Change my journey</span></a>
      </div>
      <dl className="hidden gap-3 sm:grid sm:grid-cols-3">
        {facts.map((f) => (
          <div key={f.label} className="rounded-xl bg-muted/60 px-4 py-3">
            <dt className="text-xs text-muted-foreground">{f.label}</dt>
            <dd className="text-base font-semibold text-ink">{f.value}</dd>
          </div>
        ))}
      </dl>
      <div className="hidden space-y-1.5 sm:block">
        <p className="text-sm font-semibold text-ink">What this changes for you</p>
        <ul className="space-y-1 text-sm text-ink">
          {changes.map((c) => <li key={c} className="flex gap-2"><Chip tone="good">On</Chip><span>{c}</span></li>)}
        </ul>
      </div>
      {tune && (
        <p className="flex items-center justify-between gap-2 rounded-xl bg-muted/60 px-3 py-2.5 text-sm text-ink sm:gap-3 sm:px-4 sm:py-3">
          <span><span className="font-semibold">Build your plan.</span><span className="hidden sm:inline"> {tune.text}</span></span>
          <a href="#" className="inline-flex h-9 shrink-0 items-center rounded-full bg-ink px-4 text-sm font-semibold text-white hover:opacity-90"><span className="sm:hidden">2 questions</span><span className="hidden sm:inline">{tune.action}</span></a>
        </p>
      )}
      {switchLabel && <a href="#" className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted">{switchLabel}</a>}
    </section>
  )
}
