import { cronBundle } from '@/lib/cron/bundle'
import { GET as week1_kickoff } from '../week1-kickoff/route'
import { GET as candidate_email_dispatch } from '../candidate-email-dispatch/route'
import { GET as talent_intake } from '../talent-intake/route'

// Jobs run in this order, lightest first, so one slow job at the end cannot hold up the rest.
export const maxDuration = 800

export const GET = cronBundle({
  'week1-kickoff': week1_kickoff,
  'candidate-email-dispatch': candidate_email_dispatch,
  'talent-intake': talent_intake,
})
