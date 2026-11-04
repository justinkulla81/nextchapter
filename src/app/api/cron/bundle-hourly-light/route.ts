import { cronBundle } from '@/lib/cron/bundle'
import { GET as indexnow_layoffs } from '../indexnow-layoffs/route'
import { GET as mailing_verify } from '../mailing-verify/route'
import { GET as topic_snapshots } from '../topic-snapshots/route'

// Jobs run in this order, lightest first, so one slow job at the end cannot hold up the rest.
export const maxDuration = 800

export const GET = cronBundle({
  'indexnow-layoffs': indexnow_layoffs,
  'mailing-verify': mailing_verify,
  'topic-snapshots': topic_snapshots,
})
