import Link from 'next/link'
import type { RecruiterRow } from '@/lib/crm/ecosystem'
import { functionName, industryName } from '@/lib/crm/coverage'

/** Recruiters with where, what and which functions they cover. Shared by the Recruiters, Industries, Functions and Geography pages. */
export function RecruiterTable({ rows, total, empty }: { rows: RecruiterRow[]; total: number; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>
  return (
    <div className="space-y-2">
      <ul className="divide-y divide-border rounded-lg border border-border text-sm">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1 px-3 py-2">
            <div className="min-w-0">
              <Link href={`/support/admin/crm/people/${r.id}`} className="font-medium text-brand hover:underline">{r.name}</Link>
              <p className="text-muted-foreground">{[r.title, r.org].filter(Boolean).join(' · ') || 'No title on file'}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {[r.states.join(', '), r.industries.slice(0, 3).map(industryName).join(', '), r.functions.slice(0, 3).map(functionName).join(', ')].filter(Boolean).join(' | ') || 'Not tagged yet'}
              </p>
            </div>
            <div className="text-right text-xs">
              {r.email ? <a href={`mailto:${r.email}`} className="text-brand hover:underline">{r.email}</a> : <span className="text-muted-foreground">No email yet</span>}
              {r.guessed && <span className="text-muted-foreground"> (guessed)</span>}
              {r.phone && <p className="text-muted-foreground">{r.phone}</p>}
            </div>
          </li>
        ))}
      </ul>
      {total > rows.length && <p className="text-xs text-muted-foreground">Showing {rows.length} of {total}. Narrow with the filters above.</p>}
    </div>
  )
}
