import { cronBundle } from '@/lib/cron/bundle'
import { GET as lead_lifecycle } from '../lead-lifecycle/route'
import { GET as mailing_send } from '../mailing-send/route'

// Jobs run in this order, lightest first, so one slow job at the end cannot hold up the rest.
export const maxDuration = 800

export const GET = cronBundle({
  'lead-lifecycle': lead_lifecycle,
  'mailing-send': mailing_send,
})
