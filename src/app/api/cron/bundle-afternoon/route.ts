import { cronBundle } from '@/lib/cron/bundle'
import { GET as lead_nurture } from '../lead-nurture/route'
import { GET as layoff_alerts } from '../layoff-alerts/route'
import { GET as job_alerts } from '../job-alerts/route'
import { GET as deadline_reminders } from '../deadline-reminders/route'
import { GET as census_comms } from '../census-comms/route'
import { GET as notify_recruiters_new_candidates } from '../notify-recruiters-new-candidates/route'
import { GET as backchannel_match } from '../backchannel-match/route'
import { GET as registration_reminders } from '../registration-reminders/route'
import { GET as interim_role_reverify } from '../interim-role-reverify/route'

// Jobs run in this order, lightest first, so one slow job at the end cannot hold up the rest.
export const maxDuration = 800

export const GET = cronBundle({
  'lead-nurture': lead_nurture,
  'layoff-alerts': layoff_alerts,
  'job-alerts': job_alerts,
  'deadline-reminders': deadline_reminders,
  'census-comms': census_comms,
  'notify-recruiters-new-candidates': notify_recruiters_new_candidates,
  'backchannel-match': backchannel_match,
  'registration-reminders': registration_reminders,
  'interim-role-reverify': interim_role_reverify,
})
