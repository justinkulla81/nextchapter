import { feedHeadTail, feedPartUrl, readFeedManifest } from '@/lib/syndication/job-feed-server'

// https://launchyournextchapter.com/feeds/jobs.xml.gz — the aggregator feed (Indeed-style
// XML, gzipped) of every job with a public page. Built daily into Supabase Storage as
// parts (src/lib/syndication/job-feed-server.ts); this streams a gzipped header, the parts
// and a gzipped footer as one .gz file (concatenated gzip members are a valid gzip file),
// never holding it in memory.
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET() {
  const m = await readFeedManifest().catch(() => null)
  if (!m || m.parts.length === 0) return new Response('The job feed is being built. Try again later.', { status: 503, headers: { 'Retry-After': '3600' } })
  const { head, tail } = await feedHeadTail(m)
  const length = head.length + tail.length + m.parts.reduce((n, p) => n + p.bytes, 0)

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(new Uint8Array(head))
        for (const part of m.parts) {
          // ?v= reads past the storage CDN's copy of an older build of the part.
          const res = await fetch(`${feedPartUrl(part)}?v=${encodeURIComponent(part.builtAt)}`, { cache: 'no-store' })
          if (!res.ok || !res.body) throw new Error(`feed part ${part.path}: ${res.status}`)
          const reader = res.body.getReader()
          for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            controller.enqueue(value)
          }
        }
        controller.enqueue(new Uint8Array(tail))
        controller.close()
      } catch (error) {
        console.error('Job feed stream failed', error)
        controller.error(error)
      }
    },
  })

  return new Response(body, {
    headers: {
      'Content-Type': 'application/gzip',
      'Content-Length': String(length),
      'Content-Disposition': 'attachment; filename="jobs.xml.gz"',
      'Last-Modified': new Date(m.updatedAt).toUTCString(),
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
