import { cronBundle } from '@/lib/cron/bundle'
import { GET as pivot_market } from '../pivot-market/route'
import { GET as market_size } from '../market-size/route'
import { GET as company_hiring_index } from '../company-hiring-index/route'

// Jobs run in this order, lightest first, so one slow job at the end cannot hold up the rest.
export const maxDuration = 800

export const GET = cronBundle({
  'pivot-market': pivot_market,
  'market-size': market_size,
  'company-hiring-index': company_hiring_index,
})
