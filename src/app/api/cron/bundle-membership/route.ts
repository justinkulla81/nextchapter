import { cronBundle } from '@/lib/cron/bundle'
import { GET as membership_lapse_check } from '../membership-lapse-check/route'
import { GET as membership_dossier_refresh } from '../membership-dossier-refresh/route'
import { GET as membership_market_check } from '../membership-market-check/route'
import { GET as membership_network_nudge } from '../membership-network-nudge/route'
import { GET as activity_streaks } from '../activity-streaks/route'
import { GET as benefits_network_expire_listings } from '../benefits-network-expire-listings/route'

export const maxDuration = 300

export const GET = cronBundle({
  'membership-lapse-check': membership_lapse_check,
  'membership-dossier-refresh': membership_dossier_refresh,
  'membership-market-check': membership_market_check,
  'membership-network-nudge': membership_network_nudge,
  'activity-streaks': activity_streaks,
  'benefits-network-expire-listings': benefits_network_expire_listings,
})
