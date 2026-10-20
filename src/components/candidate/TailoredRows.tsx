import Link from 'next/link'
import type { TailoredGroup } from '@/lib/redesign/tailored'

// Improve your search: every thing we use to tailor the site, grouped by what it improves, with what each
// changes and one place to change it. Used by the live page and the preview.
export function TailoredRows({ groups }: { groups: TailoredGroup[] }) {
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.title} aria-label={g.title} className="space-y-2">
          <h2 className="font-display text-xl font-semibold text-ink">{g.title}</h2>
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {g.rows.map((r) => (
              <li key={r.key} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div>
                  <p className="text-base font-semibold text-ink">{r.label}</p>
                  <p className="text-sm text-muted-foreground">{r.effect}</p>
                </div>
                <Link href={r.href} className="text-sm font-medium text-brand underline underline-offset-4">
                  {r.action}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
