import type { Metadata } from 'next'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { getUpcomingWebinars, getCandidateWebinarRegistrations } from '@/lib/webinars/webinars'
import { getCarouselVideos, getCarouselPodcasts } from '@/lib/content/curated-content'
import { getCandidateContentLikeKeys, contentLikeKey, getCandidateFavorites } from '@/lib/content/content-likes'
import { CuratedVideoCard } from '@/components/dashboard/CuratedVideoCard'
import { PodcastCard } from '@/components/dashboard/PodcastCard'
import { WebinarListItem } from '@/components/dashboard/WebinarListItem'
import { PageHeader } from '@/components/candidate/PageHeader'
import { Section } from '@/components/candidate/ui'
import { MoreDetails } from '@/components/dashboard/MoreDetails'
import { WebinarFeature } from '@/components/dashboard/WebinarFeature'

export const metadata: Metadata = { title: 'Videos and Webinars' }

// The redesigned empty line: a sentence, not a bordered box.
function NoneYet({ label = 'Nothing here yet. Check back soon.' }: { label?: string }) {
  return <p className="text-base text-muted-foreground">{label}</p>
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
  // The next live session, three short videos, and everything else behind one fold.
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
        {watchNow.length === 0 ? <NoneYet label="New videos are on the way. Check back soon." /> : videoRow(watchNow)}
      </Section>

      <MoreDetails summary="Show more: tips, tools, podcasts and your favorites">
        <p className="text-sm text-muted-foreground">
          Like anything that resonates and it shares to your Support Network feed. Give something a thumbs-down and we stop showing it, and after two, its channel too.
        </p>
        {moreLong.length > 0 && (
          <Section id="more-advice" title="More career and interview advice">{videoRow(moreLong)}</Section>
        )}
        <Section id="tips" title="Career and interview tips">
          {shorts.length === 0 ? <NoneYet /> : videoRow(shorts)}
        </Section>
        <Section id="tools" title="Tools for you">
          {toolsForYou.length === 0
            ? <NoneYet />
            : videoRow(toolsForYou, (v) => {
                const label = v.aiToolIndustry ?? v.aiToolFunction
                return label ? `Recommended for ${label}${v.aiToolFocus ? `: ${v.aiToolFocus}` : ''}` : (v.aiToolFocus ?? 'General AI tip')
              })}
        </Section>
        <Section id="ai" title="AI tips and tools">
          {aiTips.length === 0 ? <NoneYet /> : videoRow(aiTips, (v) => v.aiToolFocus ?? 'General AI tip')}
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
            <NoneYet />
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
            <NoneYet label="Nothing saved yet. Like a video, webinar or podcast to keep it here." />
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
