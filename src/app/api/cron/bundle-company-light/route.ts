import { cronBundle } from '@/lib/cron/bundle'
import { GET as company_outcomes } from '../company-outcomes/route'
import { GET as company_events } from '../company-events/route'

export const maxDuration = 300

export const GET = cronBundle({
  'company-outcomes': company_outcomes,
  'company-events': company_events,
})
