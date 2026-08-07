import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { NeedsFollowUpItem } from '@/lib/network/needs-follow-up'

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// Read-only nudge list, not a self-report checklist — sending the actual
// email is what earns the points (Gmail detects it automatically), so this
// only ever links out to a mailto: draft. See needs-follow-up.ts's doc
// comment for why no "mark done" button exists here.
export function NeedsFollowUpCard({ items }: { items: NeedsFollowUpItem[] }) {
  if (items.length === 0) return null

  return (
    <Card id="needs-follow-up" className="scroll-mt-4">
      <CardHeader>
        <CardTitle>Needs a follow-up</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">
          People you&apos;ve met with or heard from who haven&apos;t gotten a thank-you or follow-up
          yet. Send one to earn the points — we&apos;ll detect it automatically.
        </p>
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.contactEmail}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{item.contactName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.kind === 'meeting' ? 'Met' : 'Emailed you'} {formatDate(item.date)} —{' '}
                  {item.subject}
                </p>
              </div>
              <a
                href={item.mailtoHref}
                className="shrink-0 rounded-md border border-input px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
              >
                {item.kind === 'meeting' ? 'Send thank-you' : 'Reply'}
              </a>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
