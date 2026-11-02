import { cronBundle } from '@/lib/cron/bundle'
import { GET as mailing_drafts } from '../mailing-drafts/route'
import { GET as staff_agents } from '../staff-agents/route'
import { GET as news_discovery } from '../news-discovery/route'
import { GET as seo_title_tests } from '../seo-title-tests/route'

// Jobs run in this order, lightest first, so one slow job at the end cannot hold up the rest.
export const maxDuration = 800

export const GET = cronBundle({
  'mailing-drafts': mailing_drafts,
  'staff-agents': staff_agents,
  'news-discovery': news_discovery,
  'seo-title-tests': seo_title_tests,
})
