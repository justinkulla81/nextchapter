import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { NeedsFollowUpItem } from '@/lib/network/needs-follow-up'
import { dismissEmailActivity } from '@/app/dashboard/email-activity/actions'
import { dismissCalendarEvent } from '@/app/dashboard/calendar-activity/actions'
import { SubmitButton } from '@/components/ui/submit-button'

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// Read-only nudge list, not a self-report checklist — sending the actual
// email is what earns the points (Gmail detects it automatically), so
// "Reply"/"Send thank-you" only ever links out to a Gmail compose draft,
// never a "mark done" button. The X is the escape hatch for the other
// direction: a meeting or email that got auto-detected but isn't actually a
// real networking/interview conversation (dismissEmailActivity/
// dismissCalendarEvent set dismissedAt, the same field every stat and list
// consumer across this page already filters on).
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
              <div className="flex shrink-0 items-center gap-1.5">
                <a
                  href={item.gmailHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md border border-input px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
                >
                  {item.kind === 'meeting' ? 'Send thank-you' : 'Reply'}
                </a>
                <form
                  action={(item.kind === 'meeting' ? dismissCalendarEvent : dismissEmailActivity).bind(
                    null,
                    item.sourceId
                  )}
                >
                  <SubmitButton
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-muted-foreground"
                    title="Not a real conversation — remove from this list and your stats"
                  >
                    ✕
                  </SubmitButton>
                </form>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
