// Fails if any URL in the live sitemap is non-200 or noindex (meta tag or X-Robots-Tag).
// A noindex page in the sitemap is what triggers Search Console's "excluded by 'noindex' tag"
// emails for pages we actually want indexed. Run after deploys: npm run seo:check-sitemap
// Usage: node scripts/check-sitemap-indexable.mjs [origin]
const origin = (process.argv[2] ?? 'https://launchyournextchapter.com').replace(/\/$/, '')
const CONCURRENCY = 12

const xml = await (await fetch(`${origin}/sitemap.xml`)).text()
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
if (urls.length === 0) { console.error('No URLs found in sitemap.xml'); process.exit(2) }

const bad = []
let i = 0
async function worker() {
  while (i < urls.length) {
    const url = urls[i++]
    try {
      const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(25000) })
      const html = res.status === 200 ? await res.text() : ''
      const header = res.headers.get('x-robots-tag') ?? ''
      const meta = html.match(/<meta[^>]+name="robots"[^>]*>/i)?.[0] ?? ''
      if (res.status !== 200) bad.push(`${res.status} ${url}`)
      else if (/noindex/i.test(header) || /noindex/i.test(meta)) bad.push(`noindex ${url}`)
    } catch (e) {
      bad.push(`error ${url} (${e instanceof Error ? e.message : e})`)
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker))

console.log(`Checked ${urls.length} sitemap URLs on ${origin}: ${bad.length} problem(s)`)
for (const b of bad) console.log(`  ${b}`)
process.exit(bad.length ? 1 : 0)
