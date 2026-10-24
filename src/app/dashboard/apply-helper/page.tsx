import type { Metadata } from 'next'
import { after } from 'next/server'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { captureServerEvent } from '@/lib/posthog/server'
import { ApplyHelperPage } from '@/components/dashboard/ApplyHelperPage'
import { ApplyHelperConnect } from '@/components/dashboard/ApplyHelperConnect'

export const metadata: Metadata = { title: 'Apply helper' }

export default async function Page() {
  const profile = await getDashboardData()
  after(() => captureServerEvent(profile.id, 'apply_helper_page_viewed', {}))
  return <ApplyHelperPage connect={<ApplyHelperConnect />} />
}
