import { dismissEmailActivity } from '@/app/dashboard/email-activity/actions'
import { dismissCalendarEvent } from '@/app/dashboard/calendar-activity/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { StatTile } from '@/components/dashboard/StatTile'

export interface StatTileItem {
  id: string
  kind: 'email' | 'calendar'
  label: string
  date: Date
}

// Expands in place (via StatTile's <details>) rather than linking to another
// page, so a candidate can spot-check a count without losing their place.
// Each row's "X" tells us the auto-detection was wrong for that one item
// (sets dismissedAt), which every count/list consumer across Network, Jobs,
// and Learning now filters out — it does not delete the underlying tracked
// row. A tile with nothing in it renders as a plain (non-expandable) box.
export function NetworkStatTile({ label, items }: { label: string; items: StatTileItem[] }) {
  return (
    <StatTile value={items.length} label={label} accent={items.length > 0 ? 'brand' : 'neutral'}>
      {items.length > 0 && (
        <ul className="space-y-2">
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
    </StatTile>
  )
}
