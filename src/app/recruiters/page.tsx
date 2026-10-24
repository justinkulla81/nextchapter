import type { Metadata } from 'next'
import { PortalMarketingPage } from '@/components/marketing/PortalMarketingPage'
import { RECRUITERS } from '@/lib/marketing/portal-pages/recruiters'
import { portalMetadata } from '@/lib/marketing/portal-seo'

export const metadata: Metadata = portalMetadata(RECRUITERS.seo)

export default function RecruitersPage() {
  return <PortalMarketingPage content={RECRUITERS.content} />
}
