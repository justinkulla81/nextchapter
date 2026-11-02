import { cronBundle } from '@/lib/cron/bundle'
import { GET as demo_expiry } from '../demo-expiry/route'
import { GET as membership_lapse_check } from '../membership-lapse-check/route'
import { GET as membership_dossier_refresh } from '../membership-dossier-refresh/route'
import { GET as membership_market_check } from '../membership-market-check/route'
import { GET as membership_network_nudge } from '../membership-network-nudge/route'
import { GET as activity_streaks } from '../activity-streaks/route'
import { GET as benefits_network_expire_listings } from '../benefits-network-expire-listings/route'

// Jobs run in this order, lightest first, so one slow job at the end cannot hold up the rest.
export const maxDuration = 800

export const GET = cronBundle({
  'demo-expiry': demo_expiry,
  'membership-lapse-check': membership_lapse_check,
  'membership-dossier-refresh': membership_dossier_refresh,
  'membership-market-check': membership_market_check,
  'membership-network-nudge': membership_network_nudge,
  'activity-streaks': activity_streaks,
  'benefits-network-expire-listings': benefits_network_expire_listings,
})
