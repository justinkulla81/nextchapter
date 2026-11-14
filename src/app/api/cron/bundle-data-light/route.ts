import { cronBundle } from '@/lib/cron/bundle'
import { GET as ceo_speaking } from '../ceo-speaking/route'
import { GET as higher_ed_nightly } from '../higher-ed-nightly/route'
import { GET as catalog_seeds } from '../catalog-seeds/route'
import { GET as landed_to_managing } from '../landed-to-managing/route'
import { GET as events_refresh } from '../events-refresh/route'
import { GET as funding_opportunities } from '../funding-opportunities/route'
import { GET as expire_job_postings } from '../expire-job-postings/route'
import { GET as likely_openings } from '../likely-openings/route'

// Jobs run in this order, lightest first, so one slow job at the end cannot hold up the rest.
export const maxDuration = 800

export const GET = cronBundle({
  'ceo-speaking': ceo_speaking,
  'higher-ed-nightly': higher_ed_nightly,
  'catalog-seeds': catalog_seeds,
  'landed-to-managing': landed_to_managing,
  'events-refresh': events_refresh,
  'funding-opportunities': funding_opportunities,
  'expire-job-postings': expire_job_postings,
  'likely-openings': likely_openings,
})
