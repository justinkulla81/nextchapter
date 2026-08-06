import { dismissEmailActivity } from '@/app/dashboard/email-activity/actions'
import { dismissCalendarEvent } from '@/app/dashboard/calendar-activity/actions'
import { SubmitButton } from '@/components/ui/submit-button'

export interface StatTileItem {
  id: string
  kind: 'email' | 'calendar'
  label: string
  date: Date
}

// A <details> disclosure, not a link to another page — same pattern as
// ContactRow's "View outreach script" — so a candidate can spot-check a
// count without losing their place on the page. Each row's "X" tells us the
// auto-detection was wrong for that one item (sets dismissedAt), which
// every count/list consumer across Network, Jobs, and Learning now filters
// out — it does not delete the underlying tracked row.
export function NetworkStatTile({ label, items }: { label: string; items: StatTileItem[] }) {
  return (
    <details className="group rounded-lg border border-border p-3 [&_summary::-webkit-details-marker]:hidden">
      <summary className="cursor-pointer list-none">
        <p className="text-2xl font-bold text-foreground tabular-nums">{items.length}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </summary>
      {items.length > 0 && (
        <ul className="mt-3 space-y-2 border-t border-border pt-3">
          {items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">
                  {item.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
              </div>
              <form action={(item.kind === 'email' ? dismissEmailActivity : dismissCalendarEvent).bind(null, item.id)}>
                <SubmitButton
                  variant="ghost"
                  size="sm"
                  className="h-6 shrink-0 px-2 text-xs text-muted-foreground"
                  title="Not right? Remove this from your stats"
                >
                  ✕
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}
    </details>
  )
}
