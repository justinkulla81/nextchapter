import { cronBundle } from '@/lib/cron/bundle'
import { GET as senior_brief } from '../senior-brief/route'
import { GET as outplacement_agent } from '../outplacement-agent/route'

export const maxDuration = 300

export const GET = cronBundle({
  'senior-brief': senior_brief,
  'outplacement-agent': outplacement_agent,
})
