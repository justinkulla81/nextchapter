import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { withOAuthReturnTo } from '@/lib/google/oauth-links'
import { ConnectGmailCalendarButton } from '@/components/dashboard/ConnectGmailCalendarButton'

// Replaces the normal admin-authored Daily Message rotation (via
// PageHeaderBoxes' dailyMessageOverride) for as long as the candidate hasn't
// connected Gmail/Calendar and LinkedIn — nothing else on the dashboard
// (Victoria's advice, auto-detected actions, matches) has real data to draw
// on yet, so the honest daily message is just "go connect these two things"
// rather than a generic tip unrelated to what's actually blocking them.
function connectGmailCalendarHref(hasEmailConnection: boolean, hasCalendarConnection: boolean): string {
  if (!hasEmailConnection && !hasCalendarConnection) return '/api/auth/google-connect/start'
  if (!hasCalendarConnection) return '/api/auth/calendar/start'
  return '/api/auth/gmail/start'
}

export function PreConnectDailyMessage({
  firstName,
  hasEmailConnection,
  hasCalendarConnection,
  linkedInConnected,
}: {
  firstName: string
  hasEmailConnection: boolean
  hasCalendarConnection: boolean
  linkedInConnected: boolean
}) {
  const needsGmailOrCalendar = !hasEmailConnection || !hasCalendarConnection

  return (
    <Card className="border-brand/30 bg-brand/5">
      <CardContent className="space-y-2">
        <p className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">Daily Message</p>
        <p className="text-sm font-semibold text-navy">Welcome, {firstName}!</p>
        <div className="space-y-3 text-sm text-foreground">
          {!linkedInConnected && (
            <div>
              <p>
                We can analyze your network to surface warm introductions and the right people to
                reach out to for your target roles — once you import your LinkedIn connections.
              </p>
              <p className="mt-1 text-muted-foreground">
                <Link
                  href="/dashboard/network/contacts?buildList=1#import"
                  className="font-medium text-primary underline underline-offset-4"
                >
                  Import your LinkedIn connections
                </Link>{' '}
                — we only read a file you export yourself; we never log into your LinkedIn
                account.{' '}
                <Link href="/privacy-policy" target="_blank" className="underline underline-offset-4">
                  Learn more
                </Link>
                .
              </p>
            </div>
          )}
          {needsGmailOrCalendar && (
            <div>
              <p>
                We can automatically track your outreach and application cadence, flag when
                something looks like a fit issue, keep you aligned with your Search Strategy, and
                count real achievements toward your Certified Executive Dossier — once you connect
                Gmail and Calendar. No manual logging.
              </p>
              <p className="mt-1 text-muted-foreground">
                <ConnectGmailCalendarButton
                  href={withOAuthReturnTo(connectGmailCalendarHref(hasEmailConnection, hasCalendarConnection), '/dashboard')}
                  label="Connect Gmail and Calendar"
                  analyticsKey="pre_connect_daily_message"
                  className="font-medium text-primary underline underline-offset-4"
                />{' '}
                — read-only, we can never send, edit, or delete anything in your mailbox.{' '}
                <Link href="/privacy-policy" target="_blank" className="underline underline-offset-4">
                  Learn more
                </Link>
                .
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
