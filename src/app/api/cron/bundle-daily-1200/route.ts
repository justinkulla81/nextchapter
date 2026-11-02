import { cronBundle } from '@/lib/cron/bundle'
import { GET as job_search_daily } from '../job-search-daily/route'
import { GET as help_feedback_digest } from '../help-feedback-digest/route'
import { GET as research_inbox_sweep } from '../research-inbox-sweep/route'

export const maxDuration = 300

export const GET = cronBundle({
  'job-search-daily': job_search_daily,
  'help-feedback-digest': help_feedback_digest,
  'research-inbox-sweep': research_inbox_sweep,
})
