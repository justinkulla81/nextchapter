/**
 * Zero-cost rules for the competitor watch: read a news feed and a website with plain code, no model.
 * Pure (no network, no database) so every rule is tested. A headline only counts when it names the company
 * AND matches a keyword rule; everything else is dropped rather than guessed at.
 */
import { createHash } from 'node:crypto'
import type { CleanEvent, EventKind } from './competitor-watch-core'

export interface FeedItem { title: string; link: string; source: string | null; publishedAt: Date | null }

const decode = (s: string) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
  .replace(/&quot;|&#34;/gi, '"').replace(/&#0?39;|&apos;|&rsquo;|&lsquo;/gi, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/\s+/g, ' ').trim()

/** Reads <item> blocks from an RSS feed (Google News format). Forgiving about order and missing fields. */
export function parseRss(xml: string, max = 40): FeedItem[] {
  const out: FeedItem[] = []
  for (const m of xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)) {
    const block = m[0]
    const tag = (t: string) => { const r = block.match(new RegExp(`<${t}\\b[^>]*>([\\s\\S]*?)</${t}>`, 'i')); return r ? decode(r[1]) : null }
    const title = tag('title'); const link = tag('link')
    if (!title || !link || !/^https?:\/\//.test(link)) continue
    const d = tag('pubDate') ? new Date(tag('pubDate')!) : null
    out.push({ title, link, source: tag('source'), publishedAt: d && !Number.isNaN(d.getTime()) ? d : null })
    if (out.length >= max) break
  }
  return out
}

const RULES: { kind: EventKind; re: RegExp }[] = [
  { kind: 'CLOSURE', re: /\b(shuts? down|shutting down|shut down|ceases? operations|winding down|winds? down|going out of business|files? for (?:chapter \d+ )?bankruptcy|bankruptcy|insolven|liquidat)/i },
  { kind: 'LAYOFF', re: /\b(lay(?:s|ing)? off|laid off|layoffs?|job cuts?|cuts? (?:\d+%|\d[\d,]* (?:jobs|employees|workers|roles)|jobs|staff|workforce)|workforce reduction|reduction in force|downsiz)/i },
  { kind: 'ACQUISITION', re: /\b(acquires?|acquired|acquisition|to acquire|buys|bought|merges?|merger|to be acquired|takes? over|snapped up)\b/i },
  { kind: 'FUNDING', re: /\b(raises?|raised|secures?|closes?|lands?|announces?)\b.{0,40}(\$\s?\d[\d.,]*\s?(?:m|b|k|million|billion)?\b|series [a-f]\b|seed round|funding|investment|round)|\bseries [a-f] (?:funding|round)|\bfunding round\b|\bventure funding\b/i },
  { kind: 'WIN', re: /\b(awarded|wins?|won|selected|chosen)\b.{0,60}\b(contract|grant|rfp|bid|award|state|county|city|department|agency|board)\b|\bcontract award\b/i },
  { kind: 'LOGO', re: /\b(selects|chooses|adopts|partners? with|partnership with|signs|taps|deploys|rolls out|launches with)\b/i },
]

const stop = new Set(['inc', 'llc', 'ltd', 'corp', 'corporation', 'company', 'co', 'the', 'group', 'holdings', 'technologies', 'technology', 'solutions', 'labs'])
/** The words that must appear in a headline for it to be about this company. */
export function nameTokens(name: string): string[] {
  return name.toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((t) => t && !stop.has(t))
}
export function headlineNamesCompany(title: string, name: string): boolean {
  const toks = nameTokens(name)
  if (toks.length === 0) return false
  const t = ` ${title.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ')} `
  return toks.slice(0, 2).every((tok) => t.includes(` ${tok} `) || t.includes(` ${tok}s `))
}

export function classifyHeadline(title: string): EventKind | null {
  for (const r of RULES) if (r.re.test(title)) return r.kind
  return null
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

/** News events for one company from feed items: recent, names the company, matches a rule. Unmatched headlines are dropped. */
export function eventsFromFeed(items: FeedItem[], companyName: string, now: Date, maxAgeDays = 45, max = 8): CleanEvent[] {
  const out: CleanEvent[] = []
  const seen = new Set<string>()
  for (const it of items) {
    if (it.publishedAt && now.getTime() - it.publishedAt.getTime() > maxAgeDays * 86_400_000) continue
    if (!headlineNamesCompany(it.title, companyName)) continue
    const kind = classifyHeadline(it.title)
    if (!kind) continue
    const title = (it.source && it.title.endsWith(` - ${it.source}`) ? it.title.slice(0, -(it.source.length + 3)) : it.title).slice(0, 200)
    const dedupeKey = `${kind}:${norm(title).slice(0, 80)}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    out.push({ kind, title, summary: it.source ? `Headline from ${it.source}. Sorted by keyword, not read by a person.` : null, url: it.link, amountUsd: null, occurredAt: it.publishedAt, dedupeKey })
    if (out.length >= max) break
  }
  return out
}

export function newsFeedUrl(companyName: string): string {
  const q = `"${companyName.replace(/\(.*?\)/g, '').trim()}" when:30d`
  return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`
}

// ── Website reading ──────────────────────────────────────────────────────────

/** Visible text, one block per line, scripts and styles removed. */
export function htmlToLines(html: string): string[] {
  const body = html
    .replace(/<(script|style|noscript|svg|head)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/?(p|div|li|ul|ol|br|h[1-6]|section|article|header|footer|nav|tr|td|th|table|a|button|span)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
  const seen = new Set<string>()
  const lines: string[] = []
  for (const raw of decode(body.replace(/\n+/g, '\u0000')).split('\u0000')) {
    const l = raw.replace(/\s+/g, ' ').trim()
    if (l.length < 12 || l.length > 400 || seen.has(l)) continue
    seen.add(l)
    lines.push(l)
  }
  return lines
}

export const hashLines = (lines: string[]) => createHash('sha256').update(lines.join('\n')).digest('hex').slice(0, 32)

/** Lines present now that were not before. Cookie/date/year chatter is ignored so a banner change is not a "change". */
export function addedLines(before: string[], after: string[]): string[] {
  const had = new Set(before.map(norm))
  return after.filter((l) => !had.has(norm(l)) && !/cookie|©|copyright|privacy policy|all rights reserved|\b20\d\d\b.*\b20\d\d\b/i.test(l))
}

export interface SiteChange { changed: boolean; added: string[]; removed: number }
/** Compares a fresh read with the stored one. A tiny edit (fewer than 3 new lines) is not worth a review. */
export function compareSite(beforeLines: string[] | null, afterLines: string[], minAdded = 3): SiteChange {
  if (!beforeLines || beforeLines.length === 0) return { changed: false, added: [], removed: 0 }
  const added = addedLines(beforeLines, afterLines)
  const removed = beforeLines.filter((l) => !new Set(afterLines.map(norm)).has(norm(l))).length
  return { changed: added.length >= minAdded, added, removed }
}

/** Names of images that look like customer or partner logos: from alt text, else the file name. */
export function extractLogos(html: string, ownName: string, max = 80): string[] {
  const own = norm(ownName)
  const out: string[] = []
  const seen = new Set<string>()
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0]
    const attr = (a: string) => { const r = tag.match(new RegExp(`\\b${a}\\s*=\\s*["']([^"']*)["']`, 'i')); return r ? decode(r[1]) : '' }
    const src = attr('src') || attr('data-src'); const alt = attr('alt')
    if (!/logo|client|customer|partner|trusted|brand/i.test(`${src} ${alt} ${attr('class')}`)) continue
    let name = alt.replace(/\blogo\b/gi, '').replace(/\s+/g, ' ').trim()
    if (!name) {
      const base = src.split('?')[0].split('/').pop() ?? ''
      name = base.replace(/\.(svg|png|jpe?g|webp|gif)$/i, '').replace(/[-_]+/g, ' ').replace(/\blogo\b/gi, '').replace(/\b\d{2,4}x\d{2,4}\b/g, '').replace(/\s+/g, ' ').trim()
    }
    const k = norm(name)
    if (name.length < 2 || name.length > 60 || !k || k === own || own.includes(k) || /^(image|img|icon|logo|photo|banner|hero)\d*$/i.test(name) || seen.has(k)) continue
    seen.add(k)
    out.push(name)
    if (out.length >= max) break
  }
  return out
}

export function newLogos(before: string[], after: string[]): string[] {
  const had = new Set(before.map(norm))
  return after.filter((n) => !had.has(norm(n)))
}

/** The pages worth reading: customers, case studies and pricing links found on the home page, same site only. */
export function usefulLinks(html: string, base: string, max = 2): string[] {
  let host: string
  try { host = new URL(base).hostname.replace(/^www\./, '') } catch { return [] }
  const out: string[] = []
  for (const re of [/customers?|case-?stud|success-?stor|clients?|our-work/i, /pricing|plans/i]) {
    for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>/gi)) {
      try {
        const u = new URL(m[1], base)
        if (u.hostname.replace(/^www\./, '') !== host || !/^https?:$/.test(u.protocol)) continue
        if (re.test(u.pathname) && u.pathname.length > 1 && !out.includes(u.href)) { out.push(u.href); break }
      } catch { /* skip */ }
    }
    if (out.length >= max) break
  }
  return out.slice(0, max)
}
