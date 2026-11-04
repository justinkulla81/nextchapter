// For firms whose site was found by a web search: reads "id<TAB>domain" lines from the file given as the first argument. A domain is kept
// only when the home page's title or site name contains the start of the domain's own name (a parked page or another company fails),
// then the color is read as in brand-colors-sql.ts, else from the logo the page shares. Prints "id<TAB>color<TAB>source<TAB>domain".
// Colors that repeat across three or more firms are a platform default and are dropped. Nothing is written here.
import { readFileSync } from 'node:fs'
import { dropSharedDefaults } from '@/lib/firms/brand-color'
import { findBrandColor, findLogoColor } from '@/lib/firms/brand-color-fetch'

const CONCURRENCY = 8
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

async function namesItself(domain: string): Promise<boolean> {
  try {
    const res = await fetch(`https://${domain}`, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; NextChapterBot/1.0)' }, redirect: 'follow', signal: AbortSignal.timeout(8_000) })
    if (!res.ok) return false
    const html = (await res.text()).slice(0, 300_000)
    const title = /<title[^>]*>([^<]*)/i.exec(html)?.[1] ?? ''
    const site = /property=["']og:site_name["'][^>]*content=["']([^"']*)/i.exec(html)?.[1] ?? ''
    const base = norm(domain.split('.')[0])
    return norm(`${title} ${site}`).includes(base.slice(0, Math.min(base.length, 8)))
  } catch {
    return false
  }
}

async function main() {
  const rows = readFileSync(process.argv[2], 'utf8').split('\n').map((l) => l.split('\t')).filter((r) => r[0] && r[1])
  let out: { id: string; color: string | null; source: string; domain: string }[] = []
  let next = 0
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < rows.length) {
      const [id, domain] = rows[next++]
      if (!(await namesItself(domain))) { console.error('no match:', domain); continue }
      let r = await findBrandColor(domain)
      if (!r.color) {
        const logo = await findLogoColor(`https://${domain}`)
        if (logo) r = { color: logo, source: 'logo' }
      }
      out.push({ id, color: r.color, source: r.source, domain })
    }
  }))
  out = dropSharedDefaults(out)
  for (const o of out) if (o.color) console.log(`${o.id}\t${o.color}\t${o.source}\t${o.domain}`)
  console.error(`${out.filter((o) => o.color).length} of ${rows.length} found a color`)
}
main()
