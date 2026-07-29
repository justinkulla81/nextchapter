// Prompt 67 — reusable "bold number in a soft rounded box, gray label
// underneath" stat-callout row. Deliberately generic (just a value/label
// array) so the homepage's three product-fact stats can swap for real
// usage numbers later (Search Actions completed, median time-to-offer,
// etc.) without a rebuild — see the roadmap note on that. Off-white box +
// navy/brand-blue number per the color rule: these are plain facts, not
// locked states or counts, so no orange here.
export interface StatCallout {
  value: string
  label: string
}

export function StatCallouts({ stats }: { stats: StatCallout[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-xl bg-off-white p-6 text-center">
          <p className="text-3xl font-bold text-navy">{stat.value}</p>
          <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
        </div>
      ))}
    </div>
  )
}
