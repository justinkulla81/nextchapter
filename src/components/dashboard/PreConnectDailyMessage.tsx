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
        <ul className="list-disc space-y-1.5 pl-4 text-sm text-foreground">
          {!linkedInConnected && (
            <li>
              <Link
                href="/dashboard/network/contacts?buildList=1#import"
                className="font-medium text-primary underline underline-offset-4"
              >
                Import your LinkedIn connections
              </Link>{' '}
              — this is how we suggest people to reach out to, spot warm introductions in your
              network, and help with your networking. We only read a file you export yourself; we
              never log into your LinkedIn account.{' '}
              <Link href="/privacy-policy" target="_blank" className="underline underline-offset-4">
                Learn more
              </Link>
              .
            </li>
          )}
          {needsGmailOrCalendar && (
            <li>
              <ConnectGmailCalendarButton
                href={withOAuthReturnTo(connectGmailCalendarHref(hasEmailConnection, hasCalendarConnection), '/dashboard')}
                label="Connect Gmail and Calendar"
                analyticsKey="pre_connect_daily_message"
                className="font-medium text-primary underline underline-offset-4"
              />{' '}
              — this turns on your networking and job application CRM, tracking your search
              progress automatically so you know what you&apos;re learning and applying to.
              Read-only — we can never send, edit, or delete anything in your mailbox.{' '}
              <Link href="/privacy-policy" target="_blank" className="underline underline-offset-4">
                Learn more
              </Link>
              .
            </li>
          )}
        </ul>
        <p className="text-sm font-semibold text-foreground">
          It works like magic — once connected, the rest of NextChapter keeps itself updated for
          you.
        </p>
      </CardContent>
    </Card>
  )
}
