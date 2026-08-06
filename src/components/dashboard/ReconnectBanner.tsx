import { getReconnectStatus } from '@/lib/google/reconnect-status'
import { Button } from '@/components/ui/button'

// Prominent, reusable reminder for a Gmail/Calendar connection that expired
// (testing-mode Google OAuth tokens lapse periodically) — dropped at the top
// of any page where losing auto-detected tracking actually matters (Jobs,
// Networking) so it isn't only discoverable by scrolling into the Network
// page's own connection-detail cards. `variant="link"` is a lighter-weight
// version for surfaces (like the Sprint card) that just need a pointer, not
// a full callout.
export async function ReconnectBanner({
  candidateId,
  variant = 'banner',
}: {
  candidateId: string
  variant?: 'banner' | 'link'
}) {
  const { needsGmailReconnect, needsCalendarReconnect } = await getReconnectStatus(candidateId)
  if (!needsGmailReconnect && !needsCalendarReconnect) return null

  const services = [needsGmailReconnect && 'Gmail', needsCalendarReconnect && 'Calendar'].filter(
    Boolean
  ) as string[]
  const plural = services.length > 1

  if (variant === 'link') {
    return (
      <p className="text-sm">
        <span className="font-medium text-destructive">
          Reconnect your {services.join(' and ')} to keep activity tracked automatically
        </span>
        {' — '}
        {needsGmailReconnect && (
          <a href="/api/auth/gmail/start" className="text-primary underline underline-offset-4">
            reconnect Gmail
          </a>
        )}
        {needsGmailReconnect && needsCalendarReconnect && ' · '}
        {needsCalendarReconnect && (
          <a href="/api/auth/calendar/start" className="text-primary underline underline-offset-4">
            reconnect Calendar
          </a>
        )}
        {' '}(+5 pts{plural ? ' each' : ''}).
      </p>
    )
  }

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <p className="text-sm font-medium text-destructive">
        Your {services.join(' and ')} connection{plural ? 's need' : ' needs'} to be reconnected — job-search
        activity has stopped being tracked automatically until you do. Takes 30 seconds, earns you 5 points
        {plural ? ' per connection' : ''}.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {needsGmailReconnect && (
          <Button nativeButton={false} render={<a href="/api/auth/gmail/start" />} size="sm">
            Reconnect Gmail
          </Button>
        )}
        {needsCalendarReconnect && (
          <Button nativeButton={false} render={<a href="/api/auth/calendar/start" />} size="sm">
            Reconnect Calendar
          </Button>
        )}
      </div>
    </div>
  )
}
