import { prisma } from '@/lib/prisma'
import { isGmailTrackingTester } from '@/lib/email-tracking/gmail-oauth'

// One-time Gmail + Calendar connect callout — surfaced inline on the pages
// where the payoff is obvious (Outreach Contacts, Find Full-Time Jobs)
// rather than living as its own permanent nav destination. Internal
// testing only (isGmailTrackingTester gate). Three states: neither
// connected (full combined pitch), exactly one connected (a much smaller
// nudge naming only the missing service, since re-pitching "+20 pts,
// connect both" to someone who already connected one of them reads as if
// the app doesn't remember), both connected (hides entirely).
export async function GoogleConnectPrompt({
  candidateId,
  email,
}: {
  candidateId: string
  email: string | null
}) {
  if (!email || !(await isGmailTrackingTester(email))) return null

  const [emailConnection, calendarConnection] = await Promise.all([
    prisma.emailConnection.findFirst({ where: { candidateId, disconnectedAt: null } }),
    prisma.calendarConnection.findFirst({ where: { candidateId, disconnectedAt: null } }),
  ])
  if (emailConnection && calendarConnection) return null

  if (emailConnection || calendarConnection) {
    const missing = emailConnection ? 'Calendar' : 'Gmail'
    const startPath = emailConnection ? '/api/auth/calendar/start' : '/api/auth/gmail/start'
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
        <p className="text-sm text-foreground">
          Connect {missing} too — <span className="text-muted-foreground">+10 pts, one time</span>
        </p>
        <a
          href={startPath}
          className="inline-flex h-8 shrink-0 items-center justify-center rounded-md bg-brand px-3 text-sm font-medium text-white hover:bg-brand/90"
        >
          Connect {missing}
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-2 rounded-lg border border-brand/30 bg-brand/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">Connect Gmail &amp; Calendar</p>
        <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
          +20 pts, one time
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        One click, one Google sign-in for both — after that, your outreach notes, application replies,
        interview invites, and calls get picked up automatically instead of you logging each one by hand.
      </p>
      <a
        href="/api/auth/google-connect/start"
        className="inline-flex h-9 items-center justify-center rounded-md bg-brand px-4 text-sm font-medium text-white hover:bg-brand/90"
      >
        Connect Gmail &amp; Calendar
      </a>
    </div>
  )
}
