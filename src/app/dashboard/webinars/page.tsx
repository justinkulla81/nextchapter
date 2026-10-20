import type { Metadata } from 'next'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { getUpcomingWebinars, getCandidateWebinarRegistrations } from '@/lib/webinars/webinars'
import { getCarouselVideos, getCarouselPodcasts } from '@/lib/content/curated-content'
import { getCandidateContentLikeKeys, contentLikeKey, getCandidateFavorites } from '@/lib/content/content-likes'
import { CuratedVideoCard } from '@/components/dashboard/CuratedVideoCard'
import { PodcastCard } from '@/components/dashboard/PodcastCard'
import { WebinarListItem } from '@/components/dashboard/WebinarListItem'
import { isRedesignOn } from '@/lib/redesign/flag'
import { PageHeader } from '@/components/candidate/PageHeader'
import { Section } from '@/components/candidate/ui'
import { MoreDetails } from '@/components/dashboard/MoreDetails'
import { WebinarFeature } from '@/components/dashboard/WebinarFeature'

export const metadata: Metadata = { title: 'Videos and Webinars' }

function SectionHeading({ children, id }: { children: React.ReactNode; id?: string }) {
  return <h2 id={id} className="font-serif text-xl font-semibold tracking-tight text-navy">{children}</h2>
}

function EmptyCarousel({ label = 'Nothing here yet — check back soon.' }: { label?: string }) {
  return (
    <p className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
      {label}
    </p>
  )
}

export default async function WebinarsPage() {
  const profile = await getDashboardProfile()
  const [webinars, registeredIds, { longForm, shorts, toolsForYou, aiTips }, podcasts, likedKeys, favorites] = await Promise.all([
    getUpcomingWebinars(profile.id),
    getCandidateWebinarRegistrations(profile.id),
    getCarouselVideos(profile.id),
    getCarouselPodcasts(profile.id),
    getCandidateContentLikeKeys(profile.id),
    getCandidateFavorites(profile.id),
  ])

  const hasFavorites = favorites.videos.length > 0 || favorites.podcasts.length > 0 || favorites.webinars.length > 0
  const [nextWebinar, ...laterWebinars] = webinars
  const watch = longForm.slice(0, 6)

  const videoRow = (videos: typeof longForm, citation?: (v: (typeof longForm)[number]) => string | undefined) => (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {videos.map((video) => (
        <CuratedVideoCard key={video.id} video={video} isLiked={likedKeys.has(contentLikeKey('CURATED_VIDEO', video.id))} citation={citation?.(video)} />
      ))}
    </div>
  )

  if (isRedesignOn(profile.email)) {
    // Videos and webinars in the redesign: the next live session, three short videos, and everything else behind one fold.
    const [nextWebinar, ...laterWebinars] = webinars
    const watchNow = longForm.length > 0 ? longForm.slice(0, 3) : shorts.slice(0, 3)
    const moreLong = longForm.slice(3)
    const liked = (type: 'CURATED_VIDEO' | 'PODCAST' | 'WEBINAR', id: string) => likedKeys.has(contentLikeKey(type, id))
    const videoRow = (items: typeof longForm, citation?: (v: (typeof longForm)[number]) => string) =>
      items.length === 0 ? null : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {items.map((video) => (
            <CuratedVideoCard key={video.id} video={video} isLiked={liked('CURATED_VIDEO', video.id)} citation={citation?.(video)} />
          ))}
        </div>
      )
    return (
      <div className="space-y-8">
        <PageHeader title="Videos and webinars" intro="Short, practical, and picked for where you are in your search." />

        {nextWebinar ? (
          <WebinarFeature webinar={nextWebinar} isRegistered={registeredIds.has(nextWebinar.id)} />
        ) : (
          <p className="rounded-2xl border border-border p-6 text-base text-ink">No live webinar is scheduled right now. Watch a short video below, and the next session shows up here.</p>
        )}

        <Section id="watch" title="Watch when you have 10 minutes">
          {watchNow.length === 0 ? <EmptyCarousel label="New videos are on the way. Check back soon." /> : videoRow(watchNow)}
        </Section>

        <MoreDetails summary="Show more: tips, tools, podcasts and your favorites">
          <p className="text-sm text-muted-foreground">
            Like anything that resonates and it shares to your Support Network feed. Give something a thumbs-down and we stop showing it, and after two, its channel too.
          </p>
          {moreLong.length > 0 && (
            <Section id="more-advice" title="More career and interview advice">{videoRow(moreLong)}</Section>
          )}
          <Section id="tips" title="Career and interview tips">
            {shorts.length === 0 ? <EmptyCarousel /> : videoRow(shorts)}
          </Section>
          <Section id="tools" title="Tools for you">
            {toolsForYou.length === 0
              ? <EmptyCarousel />
              : videoRow(toolsForYou, (v) => {
                  const label = v.aiToolIndustry ?? v.aiToolFunction
                  return label ? `Recommended for ${label}${v.aiToolFocus ? `: ${v.aiToolFocus}` : ''}` : (v.aiToolFocus ?? 'General AI tip')
                })}
          </Section>
          <Section id="ai" title="AI tips and tools">
            {aiTips.length === 0 ? <EmptyCarousel /> : videoRow(aiTips, (v) => v.aiToolFocus ?? 'General AI tip')}
          </Section>
          {laterWebinars.length > 0 && (
            <Section id="webinars" title="More webinars">
              <div className="space-y-3">
                {laterWebinars.map((w) => (
                  <WebinarListItem key={w.id} webinar={w} isRegistered={registeredIds.has(w.id)} isLiked={liked('WEBINAR', w.id)} />
                ))}
              </div>
            </Section>
          )}
          <Section id="podcasts" title="Podcasts">
            {podcasts.length === 0 ? (
              <EmptyCarousel />
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-2">
                {podcasts.map((podcast) => (
                  <PodcastCard key={podcast.id} podcast={podcast} isLiked={liked('PODCAST', podcast.id)} />
                ))}
              </div>
            )}
          </Section>
          <Section id="favorites" title="My favorites">
            {!hasFavorites ? (
              <EmptyCarousel label="Nothing saved yet. Like a video, webinar or podcast to keep it here." />
            ) : (
              <div className="space-y-4">
                {videoRow(favorites.videos)}
                {favorites.podcasts.length > 0 && (
                  <div className="flex gap-4 overflow-x-auto pb-2">
                    {favorites.podcasts.map((podcast) => (
                      <PodcastCard key={podcast.id} podcast={podcast} isLiked={liked('PODCAST', podcast.id)} />
                    ))}
                  </div>
                )}
                {favorites.webinars.map((w) => (
                  <WebinarListItem key={w.id} webinar={w} isRegistered={registeredIds.has(w.id)} isLiked={liked('WEBINAR', w.id)} />
                ))}
              </div>
            )}
          </Section>
        </MoreDetails>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header className="space-y-1.5">
        <h1 className="font-serif text-3xl leading-tight font-semibold tracking-tight text-navy">Videos and webinars</h1>
        <p className="max-w-xl text-base text-muted-foreground">Short, practical and picked for where you are in your search. A thumbs-down hides something, and after two, its channel.</p>
      </header>

      <section aria-labelledby="next-live" className="space-y-3">
        <SectionHeading id="next-live">{nextWebinar ? 'Next live session' : 'Live sessions'}</SectionHeading>
        {nextWebinar ? (
          <WebinarListItem webinar={nextWebinar} isRegistered={registeredIds.has(nextWebinar.id)} isLiked={likedKeys.has(contentLikeKey('WEBINAR', nextWebinar.id))} />
        ) : (
          <EmptyCarousel label="Nothing scheduled right now. Check back soon." />
        )}
      </section>

      <section aria-labelledby="watch" className="space-y-3">
        <SectionHeading id="watch">Watch when you have 10 minutes</SectionHeading>
        {watch.length === 0 ? <EmptyCarousel /> : videoRow(watch)}
      </section>

      <MoreDetails summary="More videos, podcasts and your favorites">
        {laterWebinars.length > 0 && (
          <section className="space-y-3">
            <SectionHeading>More live sessions</SectionHeading>
            <div className="space-y-3">
              {laterWebinars.map((w) => (
                <WebinarListItem key={w.id} webinar={w} isRegistered={registeredIds.has(w.id)} isLiked={likedKeys.has(contentLikeKey('WEBINAR', w.id))} />
              ))}
            </div>
          </section>
        )}
        {shorts.length > 0 && (
          <section className="space-y-3">
            <SectionHeading>Quick tips</SectionHeading>
            {videoRow(shorts)}
          </section>
        )}
        {toolsForYou.length > 0 && (
          <section className="space-y-3">
            <SectionHeading>Tools for you</SectionHeading>
            {videoRow(toolsForYou, (video) => {
              const matchLabel = video.aiToolIndustry ?? video.aiToolFunction
              return matchLabel ? `Recommended for ${matchLabel}${video.aiToolFocus ? `: ${video.aiToolFocus}` : ''}` : (video.aiToolFocus ?? 'General AI tip')
            })}
          </section>
        )}
        {aiTips.length > 0 && (
          <section className="space-y-3">
            <SectionHeading>AI tips and tools</SectionHeading>
            {videoRow(aiTips, (video) => video.aiToolFocus ?? 'General AI tip')}
          </section>
        )}
        {podcasts.length > 0 && (
          <section className="space-y-3">
            <SectionHeading>Podcasts</SectionHeading>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {podcasts.map((podcast) => (
                <PodcastCard key={podcast.id} podcast={podcast} isLiked={likedKeys.has(contentLikeKey('PODCAST', podcast.id))} />
              ))}
            </div>
          </section>
        )}
        <section className="space-y-3">
          <SectionHeading>My favorites</SectionHeading>
          {!hasFavorites ? (
            <EmptyCarousel label="Nothing favorited yet. Like a video, webinar or podcast to save it here." />
          ) : (
            <div className="space-y-4">
              {favorites.videos.length > 0 && videoRow(favorites.videos)}
              {favorites.podcasts.length > 0 && (
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {favorites.podcasts.map((podcast) => (
                    <PodcastCard key={podcast.id} podcast={podcast} isLiked={likedKeys.has(contentLikeKey('PODCAST', podcast.id))} />
                  ))}
                </div>
              )}
              {favorites.webinars.length > 0 && (
                <div className="space-y-3">
                  {favorites.webinars.map((w) => (
                    <WebinarListItem key={w.id} webinar={w} isRegistered={registeredIds.has(w.id)} isLiked={likedKeys.has(contentLikeKey('WEBINAR', w.id))} />
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </MoreDetails>
    </div>
  )
}
