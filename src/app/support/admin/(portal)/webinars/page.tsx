import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { buttonVariants } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { WebinarCreateForm } from '@/components/admin/WebinarCreateForm'
import { CancelWebinarButton } from '@/components/admin/CancelWebinarButton'
import { CuratedVideoAddForm } from '@/components/admin/CuratedVideoAddForm'
import { PodcastCreateForm } from '@/components/admin/PodcastCreateForm'
import { RemoveCuratedContentButton } from '@/components/admin/RemoveCuratedContentButton'
import { getCarouselVideos, getCarouselPodcasts } from '@/lib/content/curated-content'
import { isYouTubeIngestConfigured } from '@/lib/content/youtube-ingest'

export const maxDuration = 30

// Route kept at /support/admin/webinars (unchanged) — it's linked from
// AdminNav and revalidatePath'd from several actions; renaming it would
// touch more than this page is worth. Only the on-screen heading/tabs are
// renamed to cover all four "Videos and Webinars" carousels.
export default async function AdminWebinarsPage({
  searchParams,
}: {
  searchParams: Promise<{ calendarConnected?: string; calendarError?: string }>
}) {
  await requireAdmin()
  const params = await searchParams

  const [connection, webinars, { longForm, shorts }, podcasts] = await Promise.all([
    prisma.adminGoogleCalendarConnection.findFirst(),
    prisma.webinar.findMany({
      where: { cancelledAt: null },
      orderBy: { scheduledAt: 'asc' },
      include: { registrations: { select: { id: true } } },
    }),
    getCarouselVideos(),
    getCarouselPodcasts(),
  ])

  const youtubeConfigured = isYouTubeIngestConfigured()

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Videos and Webinars</h1>
        <p className="mt-1 text-muted-foreground">
          Curate all four candidate-facing carousels — YouTube Videos, YouTube Shorts, live
          Webinars, and Podcasts. Pre-recorded video used elsewhere on the site has its own,
          separate embed system (PageContent&apos;s video fields) — unrelated to this page.
        </p>
      </div>

      {!youtubeConfigured && (
        <p className="rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">
          YOUTUBE_API_KEY isn&apos;t configured yet — auto-pull is off (nothing runs, no errors)
          and adding a video/Short below needs its title and thumbnail typed in by hand. See{' '}
          <code className="text-xs">src/lib/content/youtube-ingest.ts</code>.
        </p>
      )}

      <Tabs defaultValue="videos">
        <div className="overflow-x-auto">
          <TabsList className="h-auto min-w-full justify-start gap-1 p-1">
            <TabsTrigger value="videos" className="shrink-0 px-3 py-2">
              Videos ({longForm.length})
            </TabsTrigger>
            <TabsTrigger value="shorts" className="shrink-0 px-3 py-2">
              Shorts ({shorts.length})
            </TabsTrigger>
            <TabsTrigger value="webinars" className="shrink-0 px-3 py-2">
              Webinars ({webinars.length})
            </TabsTrigger>
            <TabsTrigger value="podcasts" className="shrink-0 px-3 py-2">
              Podcasts ({podcasts.length})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="videos" className="mt-6 space-y-4">
          <CuratedVideoAddForm youtubeConfigured={youtubeConfigured} />
          <div className="space-y-2">
            {longForm.length === 0 ? (
              <p className="text-sm text-muted-foreground">No videos yet.</p>
            ) : (
              longForm.map((video) => (
                <div
                  key={video.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{video.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {video.channelTitle} ·{' '}
                      {video.source === 'ADMIN_ADDED' ? 'Added by admin' : 'Auto-pulled'}
                    </p>
                  </div>
                  <RemoveCuratedContentButton kind="video" id={video.id} itemLabel={video.title} />
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="shorts" className="mt-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Shorts are added the same way as Videos — paste a Shorts URL (or any YouTube URL under
            {' '}
            {180} seconds) in the Videos tab&apos;s form and it&apos;ll be filed here automatically.
          </p>
          <div className="space-y-2">
            {shorts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No Shorts yet.</p>
            ) : (
              shorts.map((video) => (
                <div
                  key={video.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{video.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {video.channelTitle} ·{' '}
                      {video.source === 'ADMIN_ADDED' ? 'Added by admin' : 'Auto-pulled'}
                    </p>
                  </div>
                  <RemoveCuratedContentButton kind="video" id={video.id} itemLabel={video.title} />
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="webinars" className="mt-6 space-y-4">
          {params.calendarConnected && (
            <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">
              Google Calendar connected.
            </p>
          )}
          {params.calendarError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Connection failed ({params.calendarError}). If this is your first time connecting,
              make sure this Google account is added as a test user on the OAuth consent screen in
              Google Cloud Console — this app is still in Testing publishing status.
            </p>
          )}

          {!connection ? (
            <div className="space-y-2 rounded-lg border border-border p-4">
              <p className="text-sm font-medium text-foreground">Connect Google Calendar</p>
              <p className="text-sm text-muted-foreground">
                Needed once, to create real Calendar events with an auto-generated Meet link for
                each webinar. Uses the same Google OAuth app as candidate Calendar Connect, with
                write access instead of read-only.
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
                    <a
                      href={w.meetLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary underline"
                    >
                      {w.meetLink}
                    </a>
                  ) : (
                    <p className="text-xs text-destructive">
                      No Meet link yet — Google Calendar isn&apos;t connected, or event creation
                      failed.
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="podcasts" className="mt-6 space-y-4">
          <PodcastCreateForm />
          <div className="space-y-2">
            {podcasts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No podcasts yet.</p>
            ) : (
              podcasts.map((podcast) => (
                <div
                  key={podcast.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{podcast.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {[podcast.appleUrl && 'Apple', podcast.spotifyUrl && 'Spotify', podcast.youtubeUrl && 'YouTube']
                        .filter(Boolean)
                        .join(', ') || 'No platform links'}
                    </p>
                  </div>
                  <RemoveCuratedContentButton kind="podcast" id={podcast.id} itemLabel={podcast.title} />
                </div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
