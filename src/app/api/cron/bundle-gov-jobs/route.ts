import { cronBundle } from '@/lib/cron/bundle'
import { GET as usajobs_board_feed } from '../usajobs-board-feed/route'
import { GET as k12jobspot_feed } from '../k12jobspot-feed/route'
import { GET as careersingov_feed } from '../careersingov-feed/route'
import { GET as edjoin_feed } from '../edjoin-feed/route'
import { GET as gov_oracle_feed } from '../gov-oracle-feed/route'
import { GET as gov_csod_feed } from '../gov-csod-feed/route'
import { GET as florida_state_feed } from '../florida-state-feed/route'
import { GET as gov_workday_feed } from '../gov-workday-feed/route'
import { GET as neogov_feed } from '../neogov-feed/route'

// The government job feeds, weekly, lightest first. Each keeps its own time budget (NEOGOV 100 s, Workday 110 s, Oracle 80 s, Cornerstone 40 s, Florida 40 s,
// EdJoin 80 s, USAJOBS 70 s, K12JobSpot 40 s, CareersInGovernment 40 s), so the nine stay well inside 800 s.
export const maxDuration = 800

export const GET = cronBundle({
  'k12jobspot-feed': k12jobspot_feed,
  'careersingov-feed': careersingov_feed,
  'usajobs-board-feed': usajobs_board_feed,
  'edjoin-feed': edjoin_feed,
  'neogov-feed': neogov_feed,
  'gov-oracle-feed': gov_oracle_feed,
  'gov-csod-feed': gov_csod_feed,
  'florida-state-feed': florida_state_feed,
  'gov-workday-feed': gov_workday_feed,
})
