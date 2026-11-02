import { cronBundle } from '@/lib/cron/bundle'
import { GET as deadline_reminders } from '../deadline-reminders/route'
import { GET as census_comms } from '../census-comms/route'

export const maxDuration = 300

export const GET = cronBundle({
  'deadline-reminders': deadline_reminders,
  'census-comms': census_comms,
})
