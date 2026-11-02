import { cronBundle } from '@/lib/cron/bundle'
import { GET as competitor_awards } from '../competitor-awards/route'
import { GET as board_bids } from '../board-bids/route'
import { GET as federal_contracts } from '../federal-contracts/route'

// Jobs run in this order, lightest first, so one slow job at the end cannot hold up the rest.
export const maxDuration = 800

export const GET = cronBundle({
  'competitor-awards': competitor_awards,
  'board-bids': board_bids,
  'federal-contracts': federal_contracts,
})
