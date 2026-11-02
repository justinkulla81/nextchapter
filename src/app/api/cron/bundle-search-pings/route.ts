import { cronBundle } from '@/lib/cron/bundle'
import { GET as bing_url_submit } from '../bing-url-submit/route'
import { GET as indexnow_seo_pages } from '../indexnow-seo-pages/route'
import { GET as google_indexing_jobs } from '../google-indexing-jobs/route'
import { GET as indexnow_org_pages } from '../indexnow-org-pages/route'
import { GET as indexnow_jobs } from '../indexnow-jobs/route'

// Jobs run in this order, lightest first, so one slow job at the end cannot hold up the rest.
export const maxDuration = 800

export const GET = cronBundle({
  'bing-url-submit': bing_url_submit,
  'indexnow-seo-pages': indexnow_seo_pages,
  'google-indexing-jobs': google_indexing_jobs,
  'indexnow-org-pages': indexnow_org_pages,
  'indexnow-jobs': indexnow_jobs,
})
