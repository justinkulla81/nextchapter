import { cronBundle } from '@/lib/cron/bundle'
import { GET as help_feedback_digest } from '../help-feedback-digest/route'
import { GET as research_inbox_sweep } from '../research-inbox-sweep/route'
import { GET as job_search_daily } from '../job-search-daily/route'
import { GET as saved_job_closures } from '../saved-job-closures/route'
import { GET as firm_joined_notices } from '../firm-joined-notices/route'
import { GET as employer_brand_scan } from '../employer-brand-scan/route'

// Jobs run in this order, lightest first, so one slow job at the end cannot hold up the rest.
export const maxDuration = 800

export const GET = cronBundle({
  'help-feedback-digest': help_feedback_digest,
  'research-inbox-sweep': research_inbox_sweep,
  'saved-job-closures': saved_job_closures,
  'firm-joined-notices': firm_joined_notices,
  'employer-brand-scan': employer_brand_scan,
  // Last: it can use the whole bundle's time (it timed out on 2026-11-04 and the jobs after it never ran).
  'job-search-daily': job_search_daily,
})
