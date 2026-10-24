import type { PortalPageContent } from '@/components/marketing/PortalMarketingPage'
import type { PortalSeo } from '@/lib/marketing/portal-seo'

/** One public partner page: its metadata and its content. src/test/portal-pages.test.ts checks every entry in index.ts. */
export interface PortalPageDef {
  seo: PortalSeo
  content: PortalPageContent
}
