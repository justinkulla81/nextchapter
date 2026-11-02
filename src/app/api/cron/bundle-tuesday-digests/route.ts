import { cronBundle } from '@/lib/cron/bundle'
import { GET as market_digest_recruiters } from '../market-digest-recruiters/route'
import { GET as market_digest_employers } from '../market-digest-employers/route'

export const maxDuration = 300

export const GET = cronBundle({
  'market-digest-recruiters': market_digest_recruiters,
  'market-digest-employers': market_digest_employers,
})
