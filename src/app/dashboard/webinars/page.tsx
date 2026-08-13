import type { Metadata } from 'next'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { getUpcomingWebinars, getCandidateWebinarRegistrations } from '@/lib/webinars/webinars'
import { getCarouselVideos, getCarouselPodcasts } from '@/lib/content/curated-content'
import { getCandidateContentLikeKeys, contentLikeKey } from '@/lib/content/content-likes'
import { registerForWebinarAction } from './actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { buttonVariants } from '@/components/ui/button'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'
import { ContentLikeButton } from '@/components/dashboard/ContentLikeButton'
import { CuratedVideoCard } from '@/components/dashboard/CuratedVideoCard'
import { PodcastCard } from '@/components/dashboard/PodcastCard'

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
  const [webinars, registeredIds, { longForm, shorts }, podcasts, likedKeys] = await Promise.all([
    getUpcomingWebinars(),
    getCandidateWebinarRegistrations(profile.id),
    getCarouselVideos(),
    getCarouselPodcasts(),
    getCandidateContentLikeKeys(profile.id),
  ])

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Videos and Webinars</h1>
        <p className="text-muted-foreground">
          Curated videos, Shorts, live webinars, and podcasts to help your search — like anything
          that resonates and it&apos;ll share to your Support Network feed.
        </p>
        <PageHeaderBoxes pageKey="webinars" candidateId={profile.id} />
      </div>

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

      {/* Webinars — existing register/join flow, unchanged, with a Like added */}
      <section className="space-y-3 border-t border-border pt-6">
        <SectionHeading>Webinars</SectionHeading>
        {webinars.length === 0 ? (
          <EmptyCarousel label="Nothing scheduled right now — check back soon." />
        ) : (
          <div className="space-y-3">
            {webinars.map((w) => {
              const isRegistered = registeredIds.has(w.id)
              return (
                <div key={w.id} className="space-y-2 rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-medium text-foreground">{w.title}</p>
                      <p className="text-sm text-muted-foreground">
                        Hosted by {w.hostLabel} ·{' '}
                        {w.scheduledAt.toLocaleString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}{' '}
                        · {w.durationMinutes} min
                      </p>
                    </div>
                    {isRegistered ? (
                      <span className="shrink-0 rounded-full bg-success/15 px-2.5 py-1 text-xs font-medium text-success">
                        Registered
                      </span>
                    ) : (
                      <form action={registerForWebinarAction.bind(null, w.id)}>
                        <SubmitButton size="sm" pendingLabel="Registering…">
                          Register
                        </SubmitButton>
                      </form>
                    )}
                  </div>
                  {w.description && <p className="text-sm text-muted-foreground">{w.description}</p>}
                  {isRegistered &&
                    (w.meetLink ? (
                      <a
                        href={w.meetLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={buttonVariants({ size: 'sm' })}
                      >
                        Join link
                      </a>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Join link isn&apos;t ready yet — check back closer to the session.
                      </p>
                    ))}
                  <div className="flex justify-end">
                    <ContentLikeButton
                      contentType="WEBINAR"
                      contentId={w.id}
                      title={w.title}
                      isLiked={likedKeys.has(contentLikeKey('WEBINAR', w.id))}
                    />
                  </div>
                </div>
              )
            })}
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
