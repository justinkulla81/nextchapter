import type { Metadata } from 'next'
import { PortalMarketingPage } from '@/components/marketing/PortalMarketingPage'
import { OUTPLACEMENT } from '@/lib/marketing/portal-pages/outplacement'
import { portalMetadata } from '@/lib/marketing/portal-seo'

export const metadata: Metadata = portalMetadata(OUTPLACEMENT.seo)

// Was /employers before the outplacement and hiring products were separated. /employers is now the overview of the
// three employer sections (Hiring, Employees, Outplacement); this page is the Outplacement section.
export default function OutplacementPage() {
  return <PortalMarketingPage content={OUTPLACEMENT.content} />
}
