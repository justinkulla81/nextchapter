import { EMPLOYEES } from './employees'
import { HIGHER_EDUCATION } from './higher-education'
import { HIRING } from './hiring'
import { OUTPLACEMENT } from './outplacement'
import { RECRUITERS } from './recruiters'
import { WORKFORCE } from './workforce'
import type { PortalPageDef } from './types'

/** Every public partner page built on PortalMarketingPage. src/test/portal-pages.test.ts checks each one. */
export const PORTAL_PAGES: PortalPageDef[] = [HIGHER_EDUCATION, WORKFORCE, HIRING, EMPLOYEES, OUTPLACEMENT, RECRUITERS]
