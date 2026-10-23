import type { Metadata } from 'next'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { accessFor } from '@/lib/access/grants'
import { captureServerEvent } from '@/lib/posthog/server'
import { beFoundMode } from '@/lib/network/be-found'
import { COACH_OFFER_HREF } from '@/lib/coach/offer'
import { seniorMember } from '@/lib/coach/seniority'
import { BeFound } from '@/components/network/BeFound'

export const metadata: Metadata = { title: 'Be found' }

export default async function BeFoundPage() {
  const profile = await getDashboardProfile()
  const access = await accessFor(profile.id)
  const mode = beFoundMode(profile.confidentialSearchMode)
  captureServerEvent(profile.id, 'be_found_viewed', { mode, senior: seniorMember(profile) })
  return <BeFound mode={mode} hasCoach={access.coaching.on} coachHref={access.coaching.on ? '/dashboard/my-coaching' : COACH_OFFER_HREF} />
}
