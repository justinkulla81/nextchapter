// Today's note: the one thing to do now, why it matters, and how to start. There is only ever one of
// these on Home. "Why am I seeing this?" holds the explanation, including what the plan is set up for.
export function HomeNote({ title, why, startLabel, startHref, whyDetail }: { title: string; why: string; startLabel: string; startHref: string; whyDetail: string }) {
  return (
    <section aria-labelledby="note" className="space-y-4 rounded-2xl border border-border bg-white p-7">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-semibold text-white">Cue</span>
        <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Today&apos;s note from Victoria</span>
      </div>
      <h2 id="note" className="font-display text-3xl leading-tight font-semibold tracking-tight text-ink text-balance">
        {title}
      </h2>
      <p className="max-w-2xl text-base text-ink">
        <span className="font-semibold">Why it matters:</span> {why}
      </p>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <a href={startHref} className="inline-flex h-12 items-center rounded-full bg-action px-8 text-base font-semibold text-action-foreground hover:brightness-95">
          {startLabel}
        </a>
        <button type="button" className="text-sm font-medium text-brand underline underline-offset-4">
          Not now
        </button>
        <details className="group">
          <summary className="cursor-pointer list-none text-sm font-medium text-brand underline underline-offset-4 [&::-webkit-details-marker]:hidden">Why am I seeing this?</summary>
          <p className="mt-2 max-w-md rounded-lg bg-muted/60 p-3 text-sm text-ink">{whyDetail}</p>
        </details>
      </div>
    </section>
  )
}
