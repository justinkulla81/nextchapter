import { cronBundle } from '@/lib/cron/bundle'
import { GET as partner_scores } from '../partner-scores/route'
import { GET as workforce_boards } from '../workforce-boards/route'

// Jobs run in this order, lightest first, so one slow job at the end cannot hold up the rest.
export const maxDuration = 800

export const GET = cronBundle({
  'partner-scores': partner_scores,
  'workforce-boards': workforce_boards,
})
