import { cronBundle } from '@/lib/cron/bundle'
import { GET as nudge_recruiter_network_unlock } from '../nudge-recruiter-network-unlock/route'
import { GET as win_back } from '../win-back/route'

// Jobs run in this order, lightest first, so one slow job at the end cannot hold up the rest.
export const maxDuration = 800

export const GET = cronBundle({
  'nudge-recruiter-network-unlock': nudge_recruiter_network_unlock,
  'win-back': win_back,
})
