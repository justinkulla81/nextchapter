import type { Metadata } from 'next'
import { PortalMarketingPage } from '@/components/marketing/PortalMarketingPage'
import { HIRING } from '@/lib/marketing/portal-pages/hiring'
import { portalMetadata } from '@/lib/marketing/portal-seo'

export const metadata: Metadata = portalMetadata(HIRING.seo)

// Sibling of the auth-gated src/app/talent/(app) route group, which serves /talent/dashboard (and the rest of the
// portal), not bare /talent, so this marketing page and the real app do not collide on one path.
export default function TalentMarketingPage() {
  return <PortalMarketingPage content={HIRING.content} />
}
