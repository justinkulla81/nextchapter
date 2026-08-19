import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'

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
}: {
  firstName: string
  hasEmailConnection: boolean
  hasCalendarConnection: boolean
}) {
  return (
    <Card className="border-brand/30 bg-brand/5">
      <CardContent className="space-y-2">
        <p className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">Daily Message</p>
        <p className="text-sm font-semibold text-navy">Welcome, {firstName}!</p>
        <ul className="list-disc space-y-1.5 pl-4 text-sm text-foreground">
          <li>
            <Link
              href="/api/auth/linkedin/start"
              className="font-medium text-primary underline underline-offset-4"
            >
              Connect LinkedIn
            </Link>{' '}
            — this is how we suggest people to reach out to, spot warm introductions in your
            network, and help with your networking.
          </li>
          <li>
            <Link
              href={connectGmailCalendarHref(hasEmailConnection, hasCalendarConnection)}
              className="font-medium text-primary underline underline-offset-4"
            >
              Connect Gmail and Calendar
            </Link>{' '}
            — this is how we track your search progress automatically, build your accountability
            plan, and know what you&apos;re learning and applying to.
          </li>
        </ul>
        <p className="text-sm font-semibold text-foreground">
          It works like magic — once connected, the rest of NextChapter keeps itself updated for
          you.
        </p>
      </CardContent>
    </Card>
  )
}
