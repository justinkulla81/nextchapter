import { cronBundle } from '@/lib/cron/bundle'
import { GET as meeting_prep_send } from '../meeting-prep-send/route'
import { GET as mailing_autoassign } from '../mailing-autoassign/route'
import { GET as content_drafts } from '../content-drafts/route'
import { GET as ats_job_board_feed } from '../ats-job-board-feed/route'

// Jobs run in this order, lightest first, so one slow job at the end cannot hold up the rest.
export const maxDuration = 800

export const GET = cronBundle({
  'meeting-prep-send': meeting_prep_send,
  'mailing-autoassign': mailing_autoassign,
  'content-drafts': content_drafts,
  'ats-job-board-feed': ats_job_board_feed,
})
