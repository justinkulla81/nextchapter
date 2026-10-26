/**
 * Tells IndexNow engines (Bing, and through Bing's index the answer engines that read it) about our URLs.
 * Reads the sitemap index, collects every URL (optionally only those under a path prefix or changed since a
 * date), and submits them in batches of up to 10,000. Only public sitemap URLs are sent.
 *
 *   npx tsx scripts/seo/indexnow.ts [--only /employers/] [--since 2026-10-24] [--dry]
 *
 * The key comes from https://launchyournextchapter.com/indexnow.txt, which serves INDEXNOW_KEY.
 */
const SITE = 'https://launchyournextchapter.com'
const arg = (k: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null }

async function text(url: string): Promise<string> {
  const r = await fetch(url, { headers: { 'User-Agent': 'NextChapter-IndexNow/1.0' } })
  if (!r.ok) throw new Error(`${url} returned ${r.status}`)
  return r.text()
}

async function main() {
  const only = arg('--only')
  const since = arg('--since') ? new Date(arg('--since')!) : null
  const dry = process.argv.includes('--dry')
  const key = (await text(`${SITE}/indexnow.txt`)).trim()
  if (!/^[a-f0-9]{16,128}$/.test(key)) throw new Error('indexnow.txt did not return a key')

  const maps = [...(await text(`${SITE}/sitemap-index.xml`)).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
  const urls = new Set<string>()
  for (const m of maps) {
    if (only && !m.includes('sitemap.xml') && !m.includes(only.replace(/\//g, ''))) continue
    const xml = await text(m)
    for (const block of xml.split('<url>').slice(1)) {
      const loc = /<loc>([^<]+)<\/loc>/.exec(block)?.[1]
      if (!loc || !loc.startsWith(SITE)) continue
      if (only && !new URL(loc).pathname.startsWith(only)) continue
      const mod = /<lastmod>([^<]+)<\/lastmod>/.exec(block)?.[1]
      if (since && mod && new Date(mod) < since) continue
      urls.add(loc)
    }
  }
  const list = [...urls]
  console.log(`${list.length} URLs${only ? ` under ${only}` : ''}${since ? ` changed since ${since.toISOString().slice(0, 10)}` : ''}`)
  if (dry || list.length === 0) return

  for (let i = 0; i < list.length; i += 10_000) {
    const batch = list.slice(i, i + 10_000)
    const r = await fetch('https://api.indexnow.org/IndexNow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: new URL(SITE).host, key, keyLocation: `${SITE}/indexnow.txt`, urlList: batch }),
    })
    console.log(`batch ${i / 10_000 + 1}: ${batch.length} URLs → ${r.status} ${r.statusText}`)
    if (r.status >= 400 && r.status !== 429) throw new Error(`IndexNow rejected the batch: ${r.status}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
