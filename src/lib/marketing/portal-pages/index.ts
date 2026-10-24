import { HIGHER_EDUCATION } from './higher-education'
import { WORKFORCE } from './workforce'
import type { PortalPageDef } from './types'

/** Every public partner page built on PortalMarketingPage. src/test/portal-pages.test.ts checks each one. */
export const PORTAL_PAGES: PortalPageDef[] = [HIGHER_EDUCATION, WORKFORCE]
