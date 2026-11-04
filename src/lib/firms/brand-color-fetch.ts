import sharp from 'sharp'
import { dominantColor, pageHints, usableAccent, type BrandColorSource } from '@/lib/firms/brand-color'

// Reads a firm's brand color from its own website: one homepage request, then at most its manifest and one icon.
// A site that blocks the request, times out or has no usable color gives "none": the page keeps NextChapter's navy.

const UA = 'Mozilla/5.0 (compatible; NextChapterBot/1.0)'
const TIMEOUT_MS = 8_000
const MAX_BYTES = 1_500_000

async function get(url: string): Promise<Response | null> {
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA, accept: '*/*' }, redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) })
    return res.ok ? res : null
  } catch {
    return null
  }
}

async function text(url: string): Promise<{ body: string; url: string } | null> {
  const res = await get(url)
  if (!res) return null
  const buf = Buffer.from(await res.arrayBuffer())
  return { body: buf.subarray(0, MAX_BYTES).toString('utf8'), url: res.url || url }
}

export async function findBrandColor(website: string): Promise<{ color: string | null; source: BrandColorSource }> {
  const home = await text(/^https?:\/\//i.test(website) ? website : `https://${website}`)
  if (!home) return { color: null, source: 'none' }
  const h = pageHints(home.body, home.url)

  const theme = usableAccent(h.themeColor) ?? usableAccent(h.tileColor)
  if (theme) return { color: theme, source: 'theme-color' }

  if (h.manifestUrl) {
    const m = await text(h.manifestUrl)
    try {
      const color = usableAccent((JSON.parse(m?.body ?? '{}') as { theme_color?: string }).theme_color)
      if (color) return { color, source: 'manifest' }
    } catch { /* not JSON */ }
  }

  if (h.iconUrl) {
    const res = await get(h.iconUrl)
    if (res) {
      try {
        const { data } = await sharp(Buffer.from(await res.arrayBuffer())).resize(32, 32, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
        const color = usableAccent(dominantColor(data, 4))
        if (color) return { color, source: 'icon' }
      } catch { /* not an image sharp reads */ }
    }
  }
  return { color: null, source: 'none' }
}

/** The dominant saturated color of the logo a page shares (its og:image or twitter:image), or null. */
export async function findLogoColor(page: string): Promise<string | null> {
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

