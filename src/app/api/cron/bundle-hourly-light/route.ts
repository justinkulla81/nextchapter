import { cronBundle } from '@/lib/cron/bundle'
import { GET as egress_watch } from '../egress-watch/route'
import { GET as indexnow_layoffs } from '../indexnow-layoffs/route'
import { GET as mailing_verify } from '../mailing-verify/route'
import { GET as mailing_open_reconcile } from '../mailing-open-reconcile/route'
import { GET as topic_snapshots } from '../topic-snapshots/route'
import { GET as layoff_outreach } from '../layoff-outreach/route'
import { GET as layoff_backfill } from '../layoff-backfill/route'
import { GET as direct_reverify } from '../direct-reverify/route'

// Jobs run in this order, lightest first, so one slow job at the end cannot hold up the rest.
export const maxDuration = 800

export const GET = cronBundle({
  'egress-watch': egress_watch,
  'indexnow-layoffs': indexnow_layoffs,
  'mailing-verify': mailing_verify,
  'mailing-open-reconcile': mailing_open_reconcile,
  'topic-snapshots': topic_snapshots,
  'layoff-outreach': layoff_outreach,
  'layoff-backfill': layoff_backfill,
  'direct-reverify': direct_reverify,
})
