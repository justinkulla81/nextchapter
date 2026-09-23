import { getReconnectStatus } from '@/lib/google/reconnect-status'
import { withOAuthReturnTo } from '@/lib/google/oauth-links'
import { Button } from '@/components/ui/button'

// Prominent, reusable reminder for a Gmail/Calendar connection that expired
// (testing-mode Google OAuth tokens lapse periodically) — dropped at the top
// of any page where losing auto-detected tracking actually matters (Jobs,
// Networking) so it isn't only discoverable by scrolling into the Network
// page's own connection-detail cards. `variant="link"` is a lighter-weight
// version for surfaces (like the Sprint card) that just need a pointer, not
// a full callout. `returnTo` is this component's own page path — passed
// through to the OAuth start route so the callback lands back here instead
// of always on /dashboard/network regardless of where it was clicked from.
export async function ReconnectBanner({
  candidateId,
  returnTo,
  variant = 'banner',
}: {
  candidateId: string
  returnTo: string
  variant?: 'banner' | 'link'
}) {
  const { needsGmailReconnect, needsCalendarReconnect } = await getReconnectStatus(candidateId)
  if (!needsGmailReconnect && !needsCalendarReconnect) return null

  const services = [needsGmailReconnect && 'Gmail', needsCalendarReconnect && 'Calendar'].filter(
    Boolean
  ) as string[]
  const plural = services.length > 1

  // One Google grant covers both Gmail and Calendar, and the combined flow
  // re-arms both connections at once. Separate Gmail-only / Calendar-only
  // buttons meant reconnecting Gmail left the Calendar banner standing.
  const reconnectHref = withOAuthReturnTo('/api/auth/google-connect/start', returnTo)

  if (variant === 'link') {
    return (
      <p className="text-sm">
        <span className="font-medium text-destructive">
          Reconnect your {services.join(' and ')} to keep activity tracked automatically
        </span>
        {' — '}
        <a href={reconnectHref} className="text-primary underline underline-offset-4">
          reconnect Google
        </a>
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
        <Button nativeButton={false} render={<a href={reconnectHref} />} size="sm">
          Reconnect Google (Gmail and Calendar)
        </Button>
      </div>
    </div>
  )
}
