import type { Metadata } from 'next'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { getUpcomingWebinars, getCandidateWebinarRegistrations } from '@/lib/webinars/webinars'
import { getCarouselVideos, getCarouselPodcasts } from '@/lib/content/curated-content'
import { getCandidateContentLikeKeys, contentLikeKey, getCandidateFavorites } from '@/lib/content/content-likes'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'
import { CuratedVideoCard } from '@/components/dashboard/CuratedVideoCard'
import { PodcastCard } from '@/components/dashboard/PodcastCard'
import { WebinarListItem } from '@/components/dashboard/WebinarListItem'
import { isRedesignOn } from '@/lib/redesign/flag'
import { PageHeader } from '@/components/candidate/PageHeader'
import { Section } from '@/components/candidate/ui'
import { MoreDetails } from '@/components/dashboard/MoreDetails'
import { WebinarFeature } from '@/components/dashboard/WebinarFeature'

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

      {/* Career and Interview Advice (long-form) */}
      <section className="space-y-3 border-t border-border pt-6">
        <SectionHeading>Career and Interview Advice</SectionHeading>
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

      {/* Career and Interview Tips (Shorts) */}
      <section className="space-y-3 border-t border-border pt-6">
        <SectionHeading>Career and Interview Tips</SectionHeading>
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

      {/* Tools for You — AI-tool explainer/demo videos matched to the
          candidate's industry, secondary industry, target function, or
          secondary function (see getCarouselVideos). Falls back to the
          general cross-industry/function pool (industry-leading tools like
          ChatGPT/HubSpot) when nothing is tagged for any of the four
          signals, so this only renders empty when there's no AI-tools
          content in the catalog at all. */}
      <section className="space-y-3 border-t border-border pt-6">
        <SectionHeading>Tools for You</SectionHeading>
        {toolsForYou.length === 0 ? (
          <EmptyCarousel label="Nothing here yet — check back soon." />
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {toolsForYou.map((video) => {
              const matchLabel = video.aiToolIndustry ?? video.aiToolFunction
              const citation = matchLabel
                ? `Recommended for ${matchLabel}${video.aiToolFocus ? ` — ${video.aiToolFocus}` : ''}`
                : (video.aiToolFocus ?? 'General AI tip')
              return (
                <CuratedVideoCard
                  key={video.id}
                  video={video}
                  isLiked={likedKeys.has(contentLikeKey('CURATED_VIDEO', video.id))}
                  citation={citation}
                />
              )
            })}
          </div>
        )}
      </section>

      {/* AI Tips & Tools — the cross-industry/function AI_TOOLS pool
          (aiToolIndustry and aiToolFunction both null), always visible to
          everyone regardless of match — previously a silent fallback folded
          into Tools for You above. */}
      <section className="space-y-3 border-t border-border pt-6">
        <SectionHeading>AI Tips &amp; Tools</SectionHeading>
        {aiTips.length === 0 ? (
          <EmptyCarousel />
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {aiTips.map((video) => (
              <CuratedVideoCard
                key={video.id}
                video={video}
                isLiked={likedKeys.has(contentLikeKey('CURATED_VIDEO', video.id))}
                citation={video.aiToolFocus ?? 'General AI tip'}
              />
            ))}
          </div>
        )}
      </section>

      {/* Webinars — existing register/join flow, unchanged, with Like/Dislike
          added. Row markup extracted to WebinarListItem, shared with the
          Favorites section below. */}
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

      {/* My Favorites — every liked item across all 5 content types, visually
          set apart (tinted card, not just a top border like the source
          carousels above) since it's a derived/personalized view rather than
          a content source of its own. Moved to the bottom — this is a
          "look back at what you've saved" section, not the first thing to
          scan on the page. */}
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
    </div>
  )
}
