import 'server-only'
import { extractText, getDocumentProxy } from 'unpdf'
import mammoth from 'mammoth'
import { USER_AGENT } from '@/lib/bids/polite-fetch'
import { decodeEntities } from '@/lib/funding-opportunities/relevance'

/**
 * Fetch an opportunity's document and return its text. A listing page is read, then up to two linked documents
 * (PDF or Word) that look like the solicitation are read too. Grants.gov notices go through the Grants.gov API
 * (synopsis + the NOFO attachment). One opportunity at a time, on an admin's click; never a crawl.
 */

const MAX_BYTES = 8_000_000
const MAX_CHARS = 150_000

export interface FetchedDoc { text: string; docUrls: string[]; error: string | null }

type Got = { kind: 'pdf' | 'docx' | 'html'; buf: Buffer; url: string } | { error: string }

async function get(url: string, init?: RequestInit): Promise<Got> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { 'User-Agent': USER_AGENT, Accept: '*/*', ...(init?.headers ?? {}) },
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) return { error: `HTTP ${res.status}` }
    const buf = Buffer.from(await res.arrayBuffer()).subarray(0, MAX_BYTES)
    const type = res.headers.get('content-type') ?? ''
    const finalUrl = res.url || url
    if (/pdf/i.test(type) || buf.subarray(0, 4).toString() === '%PDF') return { kind: 'pdf', buf, url: finalUrl }
    if (/wordprocessingml|msword/i.test(type) || /\.docx(\?|$)/i.test(finalUrl)) return { kind: 'docx', buf, url: finalUrl }
    return { kind: 'html', buf, url: finalUrl }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'unreachable' }
  }
}

async function toText(g: Exclude<Got, { error: string }>): Promise<string> {
  if (g.kind === 'pdf') {
    const pdf = await getDocumentProxy(new Uint8Array(g.buf))
    const { text } = await extractText(pdf, { mergePages: true })
    return text
  }
  if (g.kind === 'docx') return (await mammoth.extractRawText({ buffer: g.buf })).value
  return htmlToText(g.buf.toString('utf8'))
}

export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|nav|footer)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  ).replace(/[ \t]+/g, ' ')
}

const DOC_WORDS = /rfp|rfq|rfi|rfqq|request.for|solicitation|nofo|nofa|proposal|bid|scope|notice.of.funding|application/i

/** Linked PDFs or Word files on a listing page, best match to the title first. Pure; exported for tests. */
export function pickDocLinks(html: string, baseUrl: string, title: string, max = 2): string[] {
  const words = title.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3)
  const seen = new Set<string>()
  const scored: { url: string; score: number }[] = []
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let url: string
    try { url = new URL(m[1], baseUrl).toString() } catch { continue }
    if (!/\.(pdf|docx?)(\?|$)/i.test(url) && !/download|getmedia|blobs|uploads/i.test(url)) continue
    if (seen.has(url)) continue
    seen.add(url)
    const text = `${decodeEntities(m[2].replace(/<[^>]+>/g, ' '))} ${decodeURIComponent(url)}`.toLowerCase()
    const score = words.filter((w) => text.includes(w)).length * 2 + (DOC_WORDS.test(text) ? 1 : 0) - (/budget|form|q\s*&\s*a|question|answer|addendum|attachment|template|minutes/i.test(text) ? 2 : 0)
    if (score > 0) scored.push({ url, score })
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, max).map((s) => s.url)
}

async function grantsGov(id: string): Promise<FetchedDoc> {
  const res = await fetch('https://api.grants.gov/v1/api/fetchOpportunity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ opportunityId: Number(id) }),
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null)
  if (!res?.ok) return { text: '', docUrls: [], error: `Grants.gov ${res?.status ?? 'unreachable'}` }
  const json = (await res.json()) as {
    data?: {
      opportunityTitle?: string
      synopsis?: Record<string, unknown>
      synopsisAttachmentFolders?: { synopsisAttachments?: { id?: number; fileName?: string; mimeType?: string }[] }[]
    }
  }
  const syn = json.data?.synopsis ?? {}
  const parts = [`Title: ${json.data?.opportunityTitle ?? ''}`]
  for (const [k, v] of Object.entries(syn)) {
    if (v == null || typeof v === 'object' && !Array.isArray(v)) continue
    parts.push(`${k}: ${typeof v === 'string' ? htmlToText(v) : JSON.stringify(v)}`)
  }
  const docUrls: string[] = []
  const atts = (json.data?.synopsisAttachmentFolders ?? []).flatMap((f) => f.synopsisAttachments ?? [])
  const nofo = atts.find((a) => /nofo|nofa|foa|announcement|solicitation|funding/i.test(a.fileName ?? '') && /pdf/i.test(`${a.mimeType} ${a.fileName}`)) ?? atts.find((a) => /pdf/i.test(`${a.mimeType} ${a.fileName}`))
  if (nofo?.id) {
    const url = `https://apply07.grants.gov/grantsws/rest/opportunity/att/download/${nofo.id}`
    const g = await get(url)
    if (!('error' in g)) {
      parts.push(`\n--- ${nofo.fileName} ---\n${await toText(g).catch(() => '')}`)
      docUrls.push(url)
    }
  }
  return { text: parts.join('\n').slice(0, MAX_CHARS), docUrls, error: null }
}

export async function fetchOpportunityText(url: string, title: string): Promise<FetchedDoc> {
  const gg = /grants\.gov\/search-results-detail\/(\d+)/.exec(url)
  if (gg) return grantsGov(gg[1])

  const first = await get(url)
  if ('error' in first) return { text: '', docUrls: [], error: first.error }
  const texts: string[] = []
  const docUrls: string[] = [first.url]
  try {
    texts.push(await toText(first))
  } catch (e) {
    return { text: '', docUrls, error: e instanceof Error ? e.message : 'unreadable' }
  }
  if (first.kind === 'html') {
    for (const link of pickDocLinks(first.buf.toString('utf8'), first.url, title)) {
      const g = await get(link)
      if ('error' in g || g.kind === 'html') continue
      const t = await toText(g).catch(() => '')
      if (t.trim()) { texts.push(`\n--- ${link} ---\n${t}`); docUrls.push(link) }
    }
  }
  const text = texts.join('\n').replace(/\n{3,}/g, '\n\n').slice(0, MAX_CHARS)
  return { text, docUrls, error: text.trim().length < 200 ? 'Too little text on the page (it may need a login or a portal).' : null }
}
