import 'server-only'
import { safeFetch } from '@/lib/http/safe-fetch'
import { iconColors } from './icon-colors'
import { scanBrand, type ScanResult } from './scan'

// Fetches an organization's home page and its stylesheets, then reads its brand colors (scan.ts). Public pages only, one request at a
// time, with size and time limits. A site that refuses the request, or draws its colors with script, comes back with no colors: the
// caller then falls back to the browser scan (scripts/branding/scan-orgs.ts) or a person sets the colors by hand.

const USER_AGENT = 'Mozilla/5.0 (compatible; NextChapterBot/1.0; +https://launchyournextchapter.com)'
const MAX_HTML = 1_500_000
const MAX_CSS = 1_000_000
const MAX_SHEETS = 5
const TIMEOUT_MS = 10_000
// Framework and font stylesheets say nothing about an organization's brand.
const SKIP_HOSTS = /(?:^|\.)(?:fonts\.googleapis\.com|fonts\.gstatic\.com|use\.typekit\.net|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|maxcdn\.bootstrapcdn\.com|stackpath\.bootstrapcdn\.com|use\.fontawesome\.com|kit\.fontawesome\.com)$/i

export class SiteScanError extends Error {}

const MAX_ICON = 400_000

export function normalizeSiteUrl(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

async function readText(res: Response, max: number): Promise<string> {
  const reader = res.body?.getReader()
  if (!reader) return (await res.text()).slice(0, max)
  const chunks: Uint8Array[] = []
  let total = 0
  while (total < max) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    total += value.byteLength
  }
  await reader.cancel().catch(() => {})
  return Buffer.concat(chunks).toString('utf8').slice(0, max)
}

async function getText(url: string, max: number): Promise<{ text: string; finalOk: boolean; status: number }> {
  const res = await safeFetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,text/css,*/*' }, signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) return { text: '', finalOk: false, status: res.status }
  return { text: await readText(res, max), finalOk: true, status: res.status }
}

export function stylesheetUrls(html: string, base: string): string[] {
  const out: string[] = []
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0]
    if (!/rel\s*=\s*["'][^"']*stylesheet/i.test(tag)) continue
    const href = /href\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]
    if (!href) continue
    try {
      const u = new URL(href.replace(/&amp;/g, '&'), base)
      if ((u.protocol !== 'http:' && u.protocol !== 'https:') || SKIP_HOSTS.test(u.hostname)) continue
      out.push(u.toString())
    } catch {
      /* a malformed link is skipped */
    }
  }
  return [...new Set(out)].slice(0, MAX_SHEETS)
}

/** The best icon the page links: an Apple touch icon, else the largest PNG or SVG icon; the conventional /apple-touch-icon.png when none is linked. */
export function iconUrl(html: string, base: string): string | null {
  const cands: { url: string; score: number }[] = []
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0]
    const rel = /rel\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase() ?? ''
    if (!/icon/.test(rel) || /mask-icon/.test(rel)) continue
    const href = /href\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]
    if (!href || /\.ico(\?|$)/i.test(href)) continue
    const size = Number(/sizes\s*=\s*["'](\d+)x\d+/i.exec(tag)?.[1] ?? 0)
    try {
      cands.push({ url: new URL(href.replace(/&amp;/g, '&'), base).toString(), score: (rel.includes('apple-touch') ? 1000 : 0) + (/\.svg(\?|$)/i.test(href) ? 500 : 0) + size })
    } catch { /* skipped */ }
  }
  cands.sort((a, b) => b.score - a.score)
  if (cands[0]) return cands[0].url
  try { return new URL('/apple-touch-icon.png', base).toString() } catch { return null }
}

async function iconHints(html: string, base: string): Promise<{ hex: string; weight: number; where: string }[]> {
  const url = iconUrl(html, base)
  if (!url) return []
  try {
    const res = await safeFetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) })
    const type = res.headers.get('content-type') ?? ''
    if (!res.ok || !/image\/(png|jpeg|webp|svg)/i.test(type)) return []
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length === 0 || buf.length > MAX_ICON) return []
    return (await iconColors(buf, 2)).map((c, i) => ({ hex: c.hex, weight: i === 0 ? 60 : 30, where: 'the site’s own icon' }))
  } catch {
    return []
  }
}

/** The home page and its stylesheets, as text. */
export async function fetchSite(website: string): Promise<{ siteUrl: string; html: string; stylesheets: { label: string; css: string }[]; hints: { hex: string; weight: number; where: string }[] }> {
  const siteUrl = normalizeSiteUrl(website)
  if (!siteUrl) throw new SiteScanError('That is not a web address we can read.')
  const home = await getText(siteUrl, MAX_HTML)
  if (!home.finalOk) throw new SiteScanError(`The site answered ${home.status}.`)
  const sheets: { label: string; css: string }[] = []
  for (const url of stylesheetUrls(home.text, siteUrl)) {
    try {
      const css = await getText(url, MAX_CSS)
      if (css.finalOk && css.text) sheets.push({ label: 'its stylesheet', css: css.text })
    } catch {
      /* one stylesheet failing does not stop the scan */
    }
  }
  return { siteUrl, html: home.text, stylesheets: sheets, hints: await iconHints(home.text, siteUrl) }
}

export async function scanSite(website: string): Promise<ScanResult & { siteUrl: string }> {
  const { siteUrl, html, stylesheets, hints } = await fetchSite(website)
  return { ...scanBrand(html, stylesheets, hints), siteUrl }
}
