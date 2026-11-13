import { cronBundle } from '@/lib/cron/bundle'
import { GET as help_feedback_digest } from '../help-feedback-digest/route'
import { GET as research_inbox_sweep } from '../research-inbox-sweep/route'
import { GET as board_warm } from '../board-warm/route'
import { GET as job_search_daily } from '../job-search-daily/route'
import { GET as saved_job_closures } from '../saved-job-closures/route'
import { GET as firm_joined_notices } from '../firm-joined-notices/route'
import { GET as employer_brand_scan } from '../employer-brand-scan/route'

// The bundle as a whole has 800 s; each job below caps itself at up to 300 s.
export const maxDuration = 800

export const GET = cronBundle({
  // First, so the member email has the bundle's time to itself. It was last and was cut off on 2026-11-13 with 21 of 26 members
  // started and 8 sent (progress note, no failures): the jobs before it had used up the 800 s. Its own caps (150 s board load,
  // 270 s hard stop) and board-warm's 200 s keep it under about 500 s, which leaves the rest of the bundle at least 300 s.
  // board-warm loads the board into this instance so job-search-daily does not read it cold (2026-11-11).
  'board-warm': board_warm,
  'job-search-daily': job_search_daily,
  'help-feedback-digest': help_feedback_digest,
  'research-inbox-sweep': research_inbox_sweep,
  'saved-job-closures': saved_job_closures,
  'firm-joined-notices': firm_joined_notices,
  'employer-brand-scan': employer_brand_scan,
})
