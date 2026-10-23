import { publicEmployerJobs } from '@/lib/jobs/public-job-page-server'
import { FEED_TAIL, feedHead, feedJobXml } from '@/lib/syndication/syndication'

// https://launchyournextchapter.com/feeds/jobs-employer.xml — the feed to submit to job
// aggregators (Indeed, Jooble, Adzuna, Talent.com). Only jobs an employer or recruiter
// gave us, not crawled ones, and each <url> is the employer's own apply link, so we are
// not presented as the source. The all-jobs feed (/feeds/jobs.xml.gz) stays for crawlers.
export const revalidate = 3600

const httpUrl = (u: string | null | undefined) => (u && /^https?:\/\//i.test(u) ? u : null)

export async function GET() {
  const jobs = await publicEmployerJobs()
  const body = feedHead(new Date()) + jobs.flatMap((j) => (httpUrl(j.url) ? [feedJobXml(j, j.url)] : [])).join('') + FEED_TAIL
  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  })
}
