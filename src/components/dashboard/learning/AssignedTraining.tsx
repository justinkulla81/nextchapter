import type { AssignedTraining as Assigned } from '@/lib/workforce/training'

// Training the person's group has picked for them (Education Hub): a short list, each with who chose it and why it fits them.
export function AssignedTraining({ items }: { items: Assigned[] }) {
  if (items.length === 0) return null
  const org = items[0].org
  return (
    <section aria-labelledby="assigned-h" className="space-y-3 rounded-xl border border-primary/30 bg-card p-5">
      <div>
        <h2 id="assigned-h" className="font-display text-xl font-semibold text-ink">
          Chosen for you by {org}
        </h2>
        <p className="text-sm text-muted-foreground">Training your group picked for people like you, by function, industry and experience.</p>
      </div>
      <ul className="divide-y divide-border">
        {items.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0 flex-1 basis-64">
              <p className="font-medium">{t.title}</p>
              <p className="text-xs text-muted-foreground">
                {[t.provider, t.why].filter(Boolean).join(' · ')}
              </p>
            </div>
            {t.url ? (
              <a href={t.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary hover:underline">
                Open the training
              </a>
            ) : (
              <span className="text-xs text-muted-foreground">Ask {t.org} how to sign up</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
