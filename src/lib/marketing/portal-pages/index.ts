import { COACHES } from './coaches'
import { EMPLOYEES } from './employees'
import { EMPLOYERS } from './employers'
import { HIGHER_EDUCATION } from './higher-education'
import { HIRING } from './hiring'
import { NONPROFITS } from './nonprofits'
import { OUTPLACEMENT } from './outplacement'
import { RAPID_RESPONSE } from './rapid-response'
import { RECRUITERS } from './recruiters'
import { WORKFORCE } from './workforce'
import type { PortalPageDef } from './types'

/** Every public partner page built on PortalMarketingPage. src/test/portal-pages.test.ts checks each one. */
export const PORTAL_PAGES: PortalPageDef[] = [
  HIGHER_EDUCATION,
  WORKFORCE,
  RAPID_RESPONSE,
  NONPROFITS,
  EMPLOYERS,
  HIRING,
  EMPLOYEES,
  OUTPLACEMENT,
  RECRUITERS,
  COACHES,
]
