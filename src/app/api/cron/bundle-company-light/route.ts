import { cronBundle } from '@/lib/cron/bundle'
import { GET as company_events } from '../company-events/route'
import { GET as company_outcomes } from '../company-outcomes/route'

// Jobs run in this order, lightest first, so one slow job at the end cannot hold up the rest.
export const maxDuration = 800

export const GET = cronBundle({
  'company-events': company_events,
  'company-outcomes': company_outcomes,
})
