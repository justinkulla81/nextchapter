import { cronBundle } from '@/lib/cron/bundle'
import { GET as registration_reminders } from '../registration-reminders/route'
import { GET as interim_role_reverify } from '../interim-role-reverify/route'

export const maxDuration = 300

export const GET = cronBundle({
  'registration-reminders': registration_reminders,
  'interim-role-reverify': interim_role_reverify,
})
