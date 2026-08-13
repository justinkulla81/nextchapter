import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { buttonVariants } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { WebinarCreateForm } from '@/components/admin/WebinarCreateForm'
import { CancelWebinarButton } from '@/components/admin/CancelWebinarButton'
import { CuratedVideoAddForm } from '@/components/admin/CuratedVideoAddForm'
import { PodcastCreateForm } from '@/components/admin/PodcastCreateForm'
import { RemoveCuratedContentButton } from '@/components/admin/RemoveCuratedContentButton'
import { getCarouselVideos, getCarouselPodcasts, getLinkedInTipsVideos } from '@/lib/content/curated-content'
import { getAdminContentStats } from '@/lib/content/content-stats'
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

  const [connection, webinars, { longForm, shorts, toolsForYou, aiTips }, podcasts, linkedInTips, stats] =
    await Promise.all([
      prisma.adminGoogleCalendarConnection.findFirst(),
      prisma.webinar.findMany({
        where: { cancelledAt: null },
        orderBy: { scheduledAt: 'asc' },
        include: { registrations: { select: { id: true } } },
      }),
      // No candidateId passed here deliberately — admin's curation view stays
      // unfiltered by candidate dislikes AND by industry personalization
      // (both are per-candidate, not a global removal); see getCarouselVideos.
      getCarouselVideos(),
      getCarouselPodcasts(),
      getLinkedInTipsVideos(),
      getAdminContentStats(),
    ])
  // Admin's AI Tools tab shows the whole catalog in one list, unsplit by
  // industry match — the toolsForYou/aiTips split only matters per-candidate.
  const aiTools = [...toolsForYou, ...aiTips]

  const youtubeConfigured = isYouTubeIngestConfigured()

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Videos and Webinars</h1>
        <p className="mt-1 text-muted-foreground">
          Curate every candidate-facing video carousel — Career and Interview Advice (long-form),
          Career and Interview Tips (Shorts), Tools for You + AI Tips &amp; Tools (AI-tool demos),
          live Webinars, and Podcasts, all shown on the candidate Videos and Webinars page — plus
          LinkedIn Tips, which is curated here but shown on the Marketing Plan page instead.
          Pre-recorded video used elsewhere on the site has its own, separate embed system
          (PageContent&apos;s video fields) — unrelated to this page.
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
            <TabsTrigger value="ai-tools" className="shrink-0 px-3 py-2">
              Tools for You ({aiTools.length})
            </TabsTrigger>
            <TabsTrigger value="linkedin-tips" className="shrink-0 px-3 py-2">
              LinkedIn Tips ({linkedInTips.length})
            </TabsTrigger>
            <TabsTrigger value="webinars" className="shrink-0 px-3 py-2">
              Webinars ({webinars.length})
            </TabsTrigger>
            <TabsTrigger value="podcasts" className="shrink-0 px-3 py-2">
              Podcasts ({podcasts.length})
            </TabsTrigger>
            <TabsTrigger value="stats" className="shrink-0 px-3 py-2">
              Stats
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

        <TabsContent value="ai-tools" className="mt-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            AI-tool explainer/demo videos, auto-pulled by industry (see AI_TOOL_TOPICS in
            youtube-ingest.ts). Rows with an industry tag show in a candidate&apos;s personalized
            &quot;Tools for You&quot; carousel when it matches their own industry; rows tagged
            &quot;General&quot; show in the separate, always-visible &quot;AI Tips &amp; Tools&quot;
            carousel instead. Add one manually the same way as Videos, then re-tag its category
            directly in the database if it needs to land here instead of General.
          </p>
          <div className="space-y-2">
            {aiTools.length === 0 ? (
              <p className="text-sm text-muted-foreground">No Tools for You videos yet.</p>
            ) : (
              aiTools.map((video) => (
                <div
                  key={video.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{video.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {video.channelTitle} · {video.aiToolIndustry ?? video.aiToolFunction ?? 'General (all industries)'} ·{' '}
                      {video.source === 'ADMIN_ADDED' ? 'Added by admin' : 'Auto-pulled'}
                    </p>
                  </div>
                  <RemoveCuratedContentButton kind="video" id={video.id} itemLabel={video.title} />
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="linkedin-tips" className="mt-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            LinkedIn posting/growth tips (writing catchy posts, getting noticed, going viral,
            commenting strategy, plus a few AI-assisted-posting angles) shown on the Marketing Plan
            page below the comfort-level card — same catalog for every candidate, no industry
            personalization. Add one manually the same way as Videos.
          </p>
          <div className="space-y-2">
            {linkedInTips.length === 0 ? (
              <p className="text-sm text-muted-foreground">No LinkedIn Tips videos yet.</p>
            ) : (
              linkedInTips.map((video) => (
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

        <TabsContent value="stats" className="mt-6 space-y-8">
          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">By item</h2>
              <p className="text-sm text-muted-foreground">
                Videos, Shorts, webinars, and podcasts currently in the carousels — sorted
                most-disliked first (ties broken by most-clicked), so problem content surfaces at
                the top.
              </p>
            </div>
            {stats.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No content yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Title</th>
                      <th className="px-3 py-2 font-medium">Type</th>
                      <th className="px-3 py-2 font-medium">Likes</th>
                      <th className="px-3 py-2 font-medium">Dislikes</th>
                      <th className="px-3 py-2 font-medium">Clicks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.items.map((item) => (
                      <tr key={`${item.contentType}:${item.contentId}`} className="border-b border-border last:border-0">
                        <td className="max-w-xs truncate px-3 py-2 text-foreground">{item.title}</td>
                        <td className="px-3 py-2 text-muted-foreground">{item.formatLabel}</td>
                        <td className="px-3 py-2 text-foreground">{item.likeCount}</td>
                        <td className="px-3 py-2 text-foreground">{item.dislikeCount}</td>
                        <td className="px-3 py-2 text-foreground">{item.clickCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">By author</h2>
              <p className="text-sm text-muted-foreground">
                YouTube channels (Videos + Shorts only — podcasts and webinars have no comparable
                &quot;author&quot;), sorted with actually-blocked channels first, then
                most-disliked. A channel is blocked for a candidate once they&apos;ve disliked 2 of
                its videos — computed live, not a stored flag.
              </p>
            </div>
            {stats.authors.length === 0 ? (
              <p className="text-sm text-muted-foreground">No video likes or dislikes yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Channel</th>
                      <th className="px-3 py-2 font-medium">Likes</th>
                      <th className="px-3 py-2 font-medium">Dislikes</th>
                      <th className="px-3 py-2 font-medium">Blocked for</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.authors.map((author) => (
                      <tr key={author.channelTitle} className="border-b border-border last:border-0">
                        <td className="max-w-xs truncate px-3 py-2 text-foreground">{author.channelTitle}</td>
                        <td className="px-3 py-2 text-foreground">{author.likeCount}</td>
                        <td className="px-3 py-2 text-foreground">{author.dislikeCount}</td>
                        <td className="px-3 py-2">
                          {author.blockedForCandidates > 0 ? (
                            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                              Blocked for {author.blockedForCandidates}{' '}
                              {author.blockedForCandidates === 1 ? 'candidate' : 'candidates'}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Not blocked</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
