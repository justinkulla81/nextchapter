import type { Metadata } from 'next'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { getUpcomingWebinars, getCandidateWebinarRegistrations } from '@/lib/webinars/webinars'
import { getCarouselVideos, getCarouselPodcasts } from '@/lib/content/curated-content'
import { getCandidateContentLikeKeys, contentLikeKey, getCandidateFavorites } from '@/lib/content/content-likes'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'
import { CuratedVideoCard } from '@/components/dashboard/CuratedVideoCard'
import { PodcastCard } from '@/components/dashboard/PodcastCard'
import { WebinarListItem } from '@/components/dashboard/WebinarListItem'

export const metadata: Metadata = { title: 'Videos and Webinars' }

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold tracking-tight">{children}</h2>
}

function EmptyCarousel({ label = 'Nothing here yet — check back soon.' }: { label?: string }) {
  return (
    <p className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
      {label}
    </p>
  )
}

export default async function WebinarsPage() {
  const profile = await getDashboardData()
  const [webinars, registeredIds, { longForm, shorts }, podcasts, likedKeys, favorites] = await Promise.all([
    getUpcomingWebinars(),
    getCandidateWebinarRegistrations(profile.id),
    getCarouselVideos(profile.id),
    getCarouselPodcasts(profile.id),
    getCandidateContentLikeKeys(profile.id),
    getCandidateFavorites(profile.id),
  ])

  const hasFavorites = favorites.videos.length > 0 || favorites.podcasts.length > 0 || favorites.webinars.length > 0

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Videos and Webinars</h1>
        <p className="text-muted-foreground">
          Curated videos, Shorts, live webinars, and podcasts to help your search — like anything
          that resonates and it&apos;ll share to your Support Network feed. Not interested in
          something? Give it a thumbs-down and we&apos;ll stop showing it (and, after two, its
          channel too).
        </p>
        <PageHeaderBoxes pageKey="webinars" candidateId={profile.id} />
      </div>

      {/* My Favorites — every liked item across all 4 content types, visually
          set apart (tinted card, not just a top border like the source
          carousels below) since it's a derived/personalized view rather than
          a content source of its own. */}
      <section className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
        <SectionHeading>My Favorites</SectionHeading>
        {!hasFavorites ? (
          <EmptyCarousel label="Nothing favorited yet — like a video, Short, webinar, or podcast to save it here." />
        ) : (
          <div className="space-y-4">
            {favorites.videos.length > 0 && (
              <div className="flex gap-4 overflow-x-auto pb-2">
                {favorites.videos.map((video) => (
                  <CuratedVideoCard
                    key={video.id}
                    video={video}
                    isLiked={likedKeys.has(contentLikeKey('CURATED_VIDEO', video.id))}
                  />
                ))}
              </div>
            )}
            {favorites.podcasts.length > 0 && (
              <div className="flex gap-4 overflow-x-auto pb-2">
                {favorites.podcasts.map((podcast) => (
                  <PodcastCard
                    key={podcast.id}
                    podcast={podcast}
                    isLiked={likedKeys.has(contentLikeKey('PODCAST', podcast.id))}
                  />
                ))}
              </div>
            )}
            {favorites.webinars.length > 0 && (
              <div className="space-y-3">
                {favorites.webinars.map((w) => (
                  <WebinarListItem
                    key={w.id}
                    webinar={w}
                    isRegistered={registeredIds.has(w.id)}
                    isLiked={likedKeys.has(contentLikeKey('WEBINAR', w.id))}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* YouTube Videos */}
      <section className="space-y-3 border-t border-border pt-6">
        <SectionHeading>YouTube Videos</SectionHeading>
        {longForm.length === 0 ? (
          <EmptyCarousel />
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {longForm.map((video) => (
              <CuratedVideoCard
                key={video.id}
                video={video}
                isLiked={likedKeys.has(contentLikeKey('CURATED_VIDEO', video.id))}
              />
            ))}
          </div>
        )}
      </section>

      {/* YouTube Shorts */}
      <section className="space-y-3 border-t border-border pt-6">
        <SectionHeading>YouTube Shorts</SectionHeading>
        {shorts.length === 0 ? (
          <EmptyCarousel />
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {shorts.map((video) => (
              <CuratedVideoCard
                key={video.id}
                video={video}
                isLiked={likedKeys.has(contentLikeKey('CURATED_VIDEO', video.id))}
              />
            ))}
          </div>
        )}
      </section>

      {/* Webinars — existing register/join flow, unchanged, with Like/Dislike
          added. Row markup extracted to WebinarListItem, shared with the
          Favorites section above. */}
      <section className="space-y-3 border-t border-border pt-6">
        <SectionHeading>Webinars</SectionHeading>
        {webinars.length === 0 ? (
          <EmptyCarousel label="Nothing scheduled right now — check back soon." />
        ) : (
          <div className="space-y-3">
            {webinars.map((w) => (
              <WebinarListItem
                key={w.id}
                webinar={w}
                isRegistered={registeredIds.has(w.id)}
                isLiked={likedKeys.has(contentLikeKey('WEBINAR', w.id))}
              />
            ))}
          </div>
        )}
      </section>

      {/* Podcasts */}
      <section className="space-y-3 border-t border-border pt-6">
        <SectionHeading>Podcasts</SectionHeading>
        {podcasts.length === 0 ? (
          <EmptyCarousel />
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {podcasts.map((podcast) => (
              <PodcastCard
                key={podcast.id}
                podcast={podcast}
                isLiked={likedKeys.has(contentLikeKey('PODCAST', podcast.id))}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
