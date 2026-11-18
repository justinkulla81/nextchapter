import type { CohortUpdate } from '@/lib/workforce/cohort-updates'

// What a group the person belongs to has posted for people like them (Talent Hub cohorts), with who posted it and why it reached them.
export function CohortUpdates({ items }: { items: CohortUpdate[] }) {
  if (items.length === 0) return null
  return (
    <section aria-labelledby="cohort-h" className="space-y-3 rounded-xl border border-primary/30 bg-card p-5">
      <div>
        <h2 id="cohort-h" className="font-display text-xl font-semibold text-ink">
          News for people like you
        </h2>
        <p className="text-sm text-muted-foreground">Updates from {items[0].org} for people in your situation.</p>
      </div>
      <ul className="divide-y divide-border">
        {items.map((u) => (
          <li key={u.id} className="space-y-0.5 py-3">
            <p className="whitespace-pre-line text-sm">{u.body}</p>
            <p className="text-xs text-muted-foreground">{u.cohort} · {u.why}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
