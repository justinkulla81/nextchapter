import { robotsAllows } from './parse'

// A deliberately slow fetcher. One request at a time across the whole run, at least GAP_MS between
// requests, robots.txt honoured, an honest user agent, and a host that answers 403/429/503 is left
// alone for the rest of the run. (A past probe with 24 parallel threads got our home IP blocked.)
export const USER_AGENT = 'NextChapterBidFinder/1.0 (+https://launchyournextchapter.com; reads public procurement pages weekly)'
const GAP_MS = 1500
const MAX_BYTES = 1_000_000

export type FetchOutcome =
  | { ok: true; url: string; html: string }
  | { ok: false; reason: 'robots' | 'blocked' | 'unreachable' | 'not_html' | 'skipped_host'; status?: number }

export class PoliteFetcher {
  private last = 0
  private robots = new Map<string, string | null>()
  private blockedHosts = new Set<string>()
  requests = 0

  constructor(private readonly gapMs = GAP_MS, private readonly doFetch: typeof fetch = fetch) {}

  private async pause() {
    const wait = this.last + this.gapMs - Date.now()
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    this.last = Date.now()
  }

  private async raw(url: string): Promise<Response | null> {
    await this.pause()
    this.requests++
    try {
      return await this.doFetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
        redirect: 'follow',
        signal: AbortSignal.timeout(12_000),
      })
    } catch {
      return null
    }
  }

  isBlocked(host: string) { return this.blockedHosts.has(host) }

  private queue: Promise<unknown> = Promise.resolve()

  /** Calls queue up: even if several are started together, only one request is ever in flight. */
  get(url: string): Promise<FetchOutcome> {
    const run = this.queue.then(() => this.fetchOne(url))
    this.queue = run.catch(() => undefined)
    return run
  }

  private async fetchOne(url: string): Promise<FetchOutcome> {
    let u: URL
    try { u = new URL(url) } catch { return { ok: false, reason: 'unreachable' } }
    if (this.blockedHosts.has(u.host)) return { ok: false, reason: 'skipped_host' }

    if (!this.robots.has(u.host)) {
      const r = await this.raw(`${u.protocol}//${u.host}/robots.txt`)
      this.robots.set(u.host, r && r.ok ? (await r.text()).slice(0, 100_000) : null)
    }
    const robots = this.robots.get(u.host)
    if (robots && !robotsAllows(robots, u.pathname + u.search)) return { ok: false, reason: 'robots' }

    const res = await this.raw(url)
    if (!res) return { ok: false, reason: 'unreachable' }
    if ([403, 429, 503].includes(res.status)) { this.blockedHosts.add(u.host); return { ok: false, reason: 'blocked', status: res.status } }
    if (!res.ok) return { ok: false, reason: 'unreachable', status: res.status }
    const type = res.headers.get('content-type') ?? ''
    if (type && !/html|text/i.test(type)) return { ok: false, reason: 'not_html' }
    const buf = Buffer.from(await res.arrayBuffer()).subarray(0, MAX_BYTES)
    return { ok: true, url: res.url || url, html: buf.toString('utf8') }
  }
}
