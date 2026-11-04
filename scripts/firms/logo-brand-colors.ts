// For firms whose own site gave no color: reads "key" lines from the file given as the first argument and prints
// "key<TAB>color<TAB>source" lines. A key is a job page address, or a short form of one on a shared job system
// (L<id> Loxo job, C<portal> Crelate portal, P<slug> careers-page.com). The firm's logo is the page's share image
// (og:image), and its dominant saturated color is the accent. If a page has no usable logo, the page's own site is
// tried the way brand-colors-sql.ts does. Colors that repeat across three or more firms are a platform default and are
// dropped. Nothing is written here.
import { readFileSync } from 'node:fs'
import sharp from 'sharp'
import { dominantColor, dropSharedDefaults, usableAccent } from '@/lib/firms/brand-color'
import { findBrandColor } from '@/lib/firms/brand-color-fetch'

const CONCURRENCY = 8
const UA = 'Mozilla/5.0 (compatible; NextChapterBot/1.0)'

function pageOf(key: string): string {
  if (key.startsWith('L')) return `https://app.loxo.co/job/${key.slice(1)}`
  if (key.startsWith('C')) return `https://jobs.crelate.com/portal/${key.slice(1)}`
  if (key.startsWith('P')) return `https://www.careers-page.com/${key.slice(1)}`
  return key
}

async function get(url: string): Promise<Response | null> {
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA, accept: '*/*' }, redirect: 'follow', signal: AbortSignal.timeout(8_000) })
    return res.ok ? res : null
  } catch {
    return null
  }
}

async function logoColor(page: string): Promise<string | null> {
  const res = await get(page)
  if (!res) return null
  const html = (await res.text()).slice(0, 400_000)
  const m = /<meta[^>]*(?:property|name)=["'](?:og|twitter):image["'][^>]*content=["']([^"']+)/i.exec(html) ?? /<meta[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og|twitter):image["']/i.exec(html)
  if (!m) return null
  let src: string
  try { src = new URL(m[1].replace(/&amp;/g, '&'), res.url).toString() } catch { return null }
  const img = await get(src)
  if (!img) return null
  try {
    const { data } = await sharp(Buffer.from(await img.arrayBuffer())).resize(64, 64, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    return usableAccent(dominantColor(data, 4))
  } catch {
    return null
  }
}

async function main() {
  const keys = readFileSync(process.argv[2], 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)
  let out: { key: string; color: string | null; source: string }[] = []
  let next = 0
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < keys.length) {
      const key = keys[next++]
      const page = pageOf(key)
      let color = await logoColor(page)
      let source = 'logo'
      if (!color && /^https?:/.test(page)) {
        const r = await findBrandColor(new URL(page).origin)
        color = r.color
        source = r.source
      }
      out.push({ key, color, source })
    }
  }))
  out = dropSharedDefaults(out)
  for (const o of out) if (o.color) console.log(`${o.key}\t${o.color}\t${o.source}`)
  console.error(`${out.filter((o) => o.color).length} of ${out.length} found a color`)
}
main()
