import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { buttonVariants } from '@/components/ui/button'
import { WebinarCreateForm } from '@/components/admin/WebinarCreateForm'
import { CancelWebinarButton } from '@/components/admin/CancelWebinarButton'

export const maxDuration = 30

export default async function AdminWebinarsPage({
  searchParams,
}: {
  searchParams: Promise<{ calendarConnected?: string; calendarError?: string }>
}) {
  await requireAdmin()
  const params = await searchParams

  const [connection, webinars] = await Promise.all([
    prisma.adminGoogleCalendarConnection.findFirst(),
    prisma.webinar.findMany({
      where: { cancelledAt: null },
      orderBy: { scheduledAt: 'asc' },
      include: { registrations: { select: { id: true } } },
    }),
  ])

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Webinars</h1>
        <p className="mt-1 text-muted-foreground">
          Live sessions candidates can register for — pre-recorded video already has its own
          embed system (see PageContent&apos;s video fields); this is scheduling only.
        </p>
      </div>

      {params.calendarConnected && (
        <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">Google Calendar connected.</p>
      )}
      {params.calendarError && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Connection failed ({params.calendarError}). If this is your first time connecting, make sure this
          Google account is added as a test user on the OAuth consent screen in Google Cloud Console — this
          app is still in Testing publishing status.
        </p>
      )}

      {!connection ? (
        <div className="space-y-2 rounded-lg border border-border p-4">
          <p className="text-sm font-medium text-foreground">Connect Google Calendar</p>
          <p className="text-sm text-muted-foreground">
            Needed once, to create real Calendar events with an auto-generated Meet link for each
            webinar. Uses the same Google OAuth app as candidate Calendar Connect, with write
            access instead of read-only.
          </p>
          <a href="/api/admin/google-calendar/connect" className={buttonVariants({ size: 'sm' })}>
            Connect Google Calendar
          </a>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Google Calendar connected as {connection.connectedByEmail ?? 'unknown'}.
        </p>
      )}

      <WebinarCreateForm />

      <div className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Upcoming</h2>
        {webinars.length === 0 ? (
          <p className="text-sm text-muted-foreground">No webinars scheduled.</p>
        ) : (
          webinars.map((w) => (
            <div key={w.id} className="space-y-1 rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{w.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {w.hostLabel} · {w.scheduledAt.toLocaleString()} · {w.durationMinutes} min ·{' '}
                    {w.registrations.length} registered
                  </p>
                </div>
                <CancelWebinarButton webinarId={w.id} />
              </div>
              {w.meetLink ? (
                <a href={w.meetLink} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">
                  {w.meetLink}
                </a>
              ) : (
                <p className="text-xs text-destructive">
                  No Meet link yet — Google Calendar isn&apos;t connected, or event creation failed.
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
