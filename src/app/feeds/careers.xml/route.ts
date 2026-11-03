import { careersFeedXml } from '@/lib/careers/job-feed'

// https://launchyournextchapter.com/feeds/careers.xml — NextChapter's own open roles for job
// aggregators (Indeed-style layout). Built from src/lib/careers/roles.ts.
export const revalidate = 21600 // 6 hours: was hourly; every regeneration is a billed ISR write

export const GET = () =>
  new Response(careersFeedXml(), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  })
