import { cronBundle } from '@/lib/cron/bundle'
import { GET as google_indexing_jobs } from '../google-indexing-jobs/route'
import { GET as indexnow_seo_pages } from '../indexnow-seo-pages/route'
import { GET as bing_url_submit } from '../bing-url-submit/route'

export const maxDuration = 300

export const GET = cronBundle({
  'google-indexing-jobs': google_indexing_jobs,
  'indexnow-seo-pages': indexnow_seo_pages,
  'bing-url-submit': bing_url_submit,
})
