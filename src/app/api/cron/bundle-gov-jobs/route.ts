import { cronBundle } from '@/lib/cron/bundle'
import { GET as usajobs_board_feed } from '../usajobs-board-feed/route'
import { GET as k12jobspot_feed } from '../k12jobspot-feed/route'
import { GET as careersingov_feed } from '../careersingov-feed/route'
import { GET as edjoin_feed } from '../edjoin-feed/route'
import { GET as gov_oracle_feed } from '../gov-oracle-feed/route'
import { GET as gov_workday_feed } from '../gov-workday-feed/route'
import { GET as neogov_feed } from '../neogov-feed/route'

// The government job feeds, weekly, lightest first. Each keeps its own time budget (NEOGOV 120 s, Workday 120 s, Oracle 90 s,
// EdJoin 100 s, USAJOBS 80 s, K12JobSpot 60 s, CareersInGovernment 60 s), so the six stay inside 800 s.
export const maxDuration = 800

export const GET = cronBundle({
  'k12jobspot-feed': k12jobspot_feed,
  'careersingov-feed': careersingov_feed,
  'usajobs-board-feed': usajobs_board_feed,
  'edjoin-feed': edjoin_feed,
  'neogov-feed': neogov_feed,
  'gov-oracle-feed': gov_oracle_feed,
  'gov-workday-feed': gov_workday_feed,
})
