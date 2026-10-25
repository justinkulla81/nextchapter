import type { Metadata } from 'next'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { accessFor } from '@/lib/access/grants'
import { captureServerEvent } from '@/lib/posthog/server'
import { COACH_OFFER_HREF } from '@/lib/coach/offer'
import { seniorMember } from '@/lib/coach/seniority'
import { boardExperienceOf } from '@/lib/network/advisory-boards'
import { AdvisoryBoards } from '@/components/network/AdvisoryBoards'

export const metadata: Metadata = { title: 'Advisory and boards' }

export default async function AdvisoryBoardsPage() {
  const profile = await getDashboardProfile()
  const access = await accessFor(profile.id)
  captureServerEvent(profile.id, 'advisory_boards_viewed', { experience: boardExperienceOf(profile.journeyDetails), senior: seniorMember(profile) })
  return <AdvisoryBoards journeyDetails={profile.journeyDetails} hasCoach={access.coaching.on} coachHref={access.coaching.on ? '/dashboard/my-coaching' : COACH_OFFER_HREF} />
}
