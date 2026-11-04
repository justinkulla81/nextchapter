// The job sitemap files (/jobs/sitemap/0.xml … 15.xml) were taken out of the sitemap index on 2026-11-04. They answer 410 Gone, which
// tells Google the files are permanently removed, so it stops fetching them. Job pages themselves are unchanged.
export const dynamic = 'force-static'

export function GET() {
  return new Response('Gone', { status: 410, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' } })
}
