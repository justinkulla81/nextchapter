import type { Metadata } from 'next'
import { after } from 'next/server'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { captureServerEvent } from '@/lib/posthog/server'
import { loadCareerStory } from '@/lib/career-story/load'
import { CareerStoryView } from '@/components/dashboard/career-story/CareerStoryView'

export const metadata: Metadata = { title: 'Your career story' }

export default async function MyCareerPage() {
  const profile = await getDashboardProfile()
  const story = await loadCareerStory(profile)
  after(() => captureServerEvent(profile.id, 'career_story_viewed', { events: story.events.length, hasPauses: story.events.some((e) => e.kind === 'PAUSE'), peersShown: story.peers.enough }))
  return <CareerStoryView story={story} from={profile.primaryFunction} />
}
