import { cronBundle } from '@/lib/cron/bundle'
import { GET as help_feedback_digest } from '../help-feedback-digest/route'
import { GET as research_inbox_sweep } from '../research-inbox-sweep/route'
import { GET as job_search_daily } from '../job-search-daily/route'

// Jobs run in this order, lightest first, so one slow job at the end cannot hold up the rest.
export const maxDuration = 800

export const GET = cronBundle({
  'help-feedback-digest': help_feedback_digest,
  'research-inbox-sweep': research_inbox_sweep,
  'job-search-daily': job_search_daily,
})
