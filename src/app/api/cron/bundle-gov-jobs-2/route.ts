import { cronBundle } from '@/lib/cron/bundle'
import { GET as gov_taleo_feed } from '../gov-taleo-feed/route'
import { GET as gov_nyc_feed } from '../gov-nyc-feed/route'
import { GET as gov_keps_feed } from '../gov-keps-feed/route'
import { GET as gov_calcareers_feed } from '../gov-calcareers-feed/route'

// More government job feeds, weekly (the day after bundle-gov-jobs), lightest first: Taleo sites 40 s, New York City 70 s,
// Kentucky school districts 70 s, California state 60 s.
export const maxDuration = 800

export const GET = cronBundle({
  'gov-taleo-feed': gov_taleo_feed,
  'gov-nyc-feed': gov_nyc_feed,
  'gov-keps-feed': gov_keps_feed,
  'gov-calcareers-feed': gov_calcareers_feed,
})
