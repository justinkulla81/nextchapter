import { careersJoobleXml } from '@/lib/careers/job-feed'

// https://launchyournextchapter.com/feeds/careers-jooble.xml — NextChapter's own open roles for job
// aggregators (Jooble's tag set). Built from src/lib/careers/roles.ts.
export const revalidate = 3600

export const GET = () =>
  new Response(careersJoobleXml(), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  })
