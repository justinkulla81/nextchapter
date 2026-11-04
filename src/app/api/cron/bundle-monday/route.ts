import { cronBundle } from '@/lib/cron/bundle'
import { GET as layoff_roundup } from '../layoff-roundup/route'
import { GET as senior_brief } from '../senior-brief/route'
import { GET as outplacement_agent } from '../outplacement-agent/route'
import { GET as course_scan } from '../course-scan/route'
import { GET as higher_ed_weekly } from '../higher-ed-weekly/route'
import { GET as market_reality_snapshot } from '../market-reality-snapshot/route'
import { GET as auto_assign_sprint } from '../auto-assign-sprint/route'
import { GET as conference_recheck } from '../conference-recheck/route'
import { GET as population_snapshot } from '../population-snapshot/route'

// Jobs run in this order, lightest first, so one slow job at the end cannot hold up the rest.
export const maxDuration = 800

export const GET = cronBundle({
  'layoff-roundup': layoff_roundup,
  'senior-brief': senior_brief,
  'outplacement-agent': outplacement_agent,
  'course-scan': course_scan,
  'higher-ed-weekly': higher_ed_weekly,
  'market-reality-snapshot': market_reality_snapshot,
  'auto-assign-sprint': auto_assign_sprint,
  'conference-recheck': conference_recheck,
  'population-snapshot': population_snapshot,
})
