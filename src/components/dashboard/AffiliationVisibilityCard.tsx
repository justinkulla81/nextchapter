import { AFFILIATION_LABELS, FIELD_LABELS } from '@/lib/affiliations/visibility'
import type { AffiliationView } from '@/lib/affiliations/load'

// "Who can see your situation": every organization connected to the member and
// what it can see right now. Your mood check-ins are never shared with anyone.
export function AffiliationVisibilityCard({ affiliations }: { affiliations: AffiliationView[] }) {
  return (
    <div className="space-y-3 border-t border-border pt-8">
      <div>
        <h2 className="text-lg font-semibold">Who can see your situation</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          You can be connected to a coach, outplacement, one or more colleges and recruiters at once. Each sees only what is listed
          here. Your mood check-ins are never shared with anyone, and a choice you make with one does not change what another sees.
        </p>
      </div>
      <ul className="space-y-3">
        {affiliations.map((a) => (
          <li key={a.key} className="rounded-lg border border-border p-4">
            <p className="text-sm font-medium text-foreground">
              {a.name} <span className="font-normal text-muted-foreground">· {AFFILIATION_LABELS[a.kind]}</span>
            </p>
            {a.sees.length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">Sees nothing about you right now.</p>
            ) : (
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
                {a.sees.map((s) => (
                  <li key={s.field}>
                    {FIELD_LABELS[s.field]}
                    {s.level === 'AGGREGATE' ? ' (counts only, never your name)' : ''}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
