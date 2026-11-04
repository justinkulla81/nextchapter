import { cronBundle } from '@/lib/cron/bundle'
import { GET as market_digest_recruiters } from '../market-digest-recruiters/route'
import { GET as market_digest_employers } from '../market-digest-employers/route'
import { GET as weekly_read } from '../weekly-read/route'
import { GET as market_digest_coaches } from '../market-digest-coaches/route'
import { GET as upgrade_offer } from '../upgrade-offer/route'
import { GET as role_network_digest } from '../role-network-digest/route'

// Jobs run in this order, lightest first, so one slow job at the end cannot hold up the rest.
export const maxDuration = 800

export const GET = cronBundle({
  'market-digest-recruiters': market_digest_recruiters,
  'market-digest-employers': market_digest_employers,
  'weekly-read': weekly_read,
  'market-digest-coaches': market_digest_coaches,
  'upgrade-offer': upgrade_offer,
  'role-network-digest': role_network_digest,
})
