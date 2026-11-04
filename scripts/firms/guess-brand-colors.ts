// For firms with no website on file: reads "slug<TAB>domain" lines from the file given as the first argument (the domain is a guess
// made from the firm's source key), keeps the guess only when the site names the firm itself (the slug appears in the page title or
// site name), then looks up the color as brand-colors-sql.ts does. Prints "slug<TAB>color<TAB>source" lines. Nothing is written here.
import { readFileSync } from 'node:fs'
import { findBrandColor } from '@/lib/firms/brand-color-fetch'

const CONCURRENCY = 8
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

async function namesFirm(domain: string, slug: string): Promise<boolean> {
  try {
    const res = await fetch(`https://${domain}`, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; NextChapterBot/1.0)' }, redirect: 'follow', signal: AbortSignal.timeout(8_000) })
    if (!res.ok) return false
    const html = (await res.text()).slice(0, 400_000)
    const title = /<title[^>]*>([^<]*)/i.exec(html)?.[1] ?? ''
    const site = /property=["']og:site_name["'][^>]*content=["']([^"']*)/i.exec(html)?.[1] ?? /content=["']([^"']*)["'][^>]*property=["']og:site_name["']/i.exec(html)?.[1] ?? ''
    return norm(`${title} ${site}`).includes(norm(slug).replace(/\d+$/, ''))
  } catch {
    return false
  }
}

async function main() {
  const rows = readFileSync(process.argv[2], 'utf8').split('\n').map((l) => l.split('\t')).filter((r) => r[0] && r[1])
  let next = 0
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < rows.length) {
      const [slug, domain] = rows[next++]
      if (!(await namesFirm(domain, slug.replace(/\.com$/, '')))) continue
      const r = await findBrandColor(domain)
      if (r.color) console.log(`${slug.replace(/\.com$/, '')}\t${r.color}\t${r.source}`)
    }
  }))
}
main()
