/**
 * Read organizations' brand colors from their own websites and keep them (OrgBrand), so their public pages and launch kits can be themed.
 *
 *   tsx --conditions=react-server --env-file=.env.local scripts/branding/scan-orgs.ts --kind WORKFORCE_BOARD [--ids KY-247,IN-220] [--limit 100] [--apply] [--browser]
 *
 * --kind     WORKFORCE_BOARD | JOB_CENTER | ECON_DEV | COLLEGE
 * --ids      only these source ids (exact); otherwise every organization of the kind that has a site and has not been done or tried lately
 * --limit    stop after this many
 * --apply    save the result (default: print only)
 * --browser  also try a real browser when the plain scan finds nothing (sites that refuse bots or draw their colors with script)
 * --force    overwrite colors that were set by hand
 *
 * Where each kind's site comes from: boards, economic development organizations and colleges have one on file; a job center has none, so its
 * own email domain is used (a free-mail address is skipped), then its workforce board's site. Several sites at a time, never the same host twice
 * at once, a short pause between requests; one scan per host per run.
 */
import { chromium, type Browser } from 'playwright'
import { prisma } from '../../src/lib/prisma'
import { fetchSite } from '../../src/lib/branding/fetch-site'
import { homeUrlOf } from '../../src/lib/branding/company-domain'
import { scanBrand, scanComputedColors, type ScanResult } from '../../src/lib/branding/scan'
import { brandMissIds, brandedIds, getOrgBrand, recordBrandMiss, saveOrgBrand, type OrgBrandKind } from '../../src/lib/branding/store'

const arg = (n: string) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined }
const flag = (n: string) => process.argv.includes(n)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const FREE_MAIL = /^(gmail|yahoo|hotmail|outlook|aol|icloud|msn|live|comcast|verizon|att|sbcglobal|bellsouth)\./i

interface Target { id: string; name: string; sites: string[] }

async function loadTargets(kind: OrgBrandKind, ids: string[]): Promise<Target[]> {
  const idFilter = ids.length ? { id: { in: ids } } : {}
  if (kind === 'WORKFORCE_BOARD') {
    const rows = await prisma.workforceBoard.findMany({ where: { website: { not: null }, ...idFilter }, select: { id: true, name: true, website: true } })
    return rows.map((r) => ({ id: r.id, name: r.name, sites: [homeUrlOf(r.website)].filter((s): s is string => !!s) }))
  }
  if (kind === 'ECON_DEV') {
    const rows = await prisma.geoOrgLead.findMany({ where: { website: { not: null }, ...idFilter }, select: { id: true, name: true, website: true } })
    return rows.map((r) => ({ id: r.id, name: r.name, sites: [homeUrlOf(r.website)].filter((s): s is string => !!s) }))
  }
  if (kind === 'COLLEGE') {
    const rows = await prisma.localCollege.findMany({ where: { website: { not: null }, ...idFilter }, select: { id: true, name: true, website: true } })
    return rows.map((r) => ({ id: r.id, name: r.name, sites: [homeUrlOf(r.website)].filter((s): s is string => !!s) }))
  }
  if (kind === 'JOB_CENTER') {
    const rows = await prisma.americanJobCenter.findMany({ where: idFilter, select: { id: true, name: true, generalEmail: true, businessEmail: true, workforceBoardId: true } })
    const boards = await prisma.workforceBoard.findMany({ where: { id: { in: rows.map((r) => r.workforceBoardId).filter((x): x is string => !!x) } }, select: { id: true, website: true } })
    const boardSite = new Map(boards.map((b) => [b.id, homeUrlOf(b.website)]))
    return rows.map((r) => {
      const domains = [r.generalEmail, r.businessEmail].map((e) => (e && e.includes('@') ? e.split('@')[1].trim().toLowerCase() : null)).filter((d): d is string => !!d && !FREE_MAIL.test(d))
      const sites = [...new Set([...domains.map((d) => homeUrlOf(d)), boardSite.get(r.workforceBoardId ?? '') ?? null].filter((s): s is string => !!s))]
      return { id: r.id, name: r.name, sites }
    })
  }
  return []
}

let browser: Browser | null = null
let browserBusy: Promise<unknown> = Promise.resolve()
async function browserScan(url: string): Promise<ScanResult> {
  const run = async (): Promise<ScanResult> => {
    browser ??= await chromium.launch()
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
      await page.waitForTimeout(2000)
      // A string, not a function: the script runner rewrites function bodies in a way the page cannot run.
      const data = (await page.evaluate(`(() => {
        var cnt = {};
        function add(c, w) { if (!c || c === 'rgba(0, 0, 0, 0)' || c === 'transparent') return; cnt[c] = (cnt[c] || 0) + w; }
        var els = Array.prototype.slice.call(document.querySelectorAll('body *'), 0, 2500);
        for (var i = 0; i < els.length; i++) { var e = els[i], r = e.getBoundingClientRect(), a = Math.max(0, r.width * r.height) / 1000, cs = getComputedStyle(e); add(cs.backgroundColor, a); add(cs.color, Math.min(a, 40)); add(cs.borderTopColor, 1); }
        var t = document.querySelector('meta[name=theme-color]');
        return { entries: Object.keys(cnt).map(function (k) { return { color: k, weight: cnt[k] }; }), theme: t ? t.content : null };
      })()`)) as { entries: { color: string; weight: number }[]; theme: string | null }
      return scanComputedColors(data.entries, data.theme)
    } finally {
      await page.close()
    }
  }
  const next = browserBusy.then(run, run)
  browserBusy = next.catch(() => {})
  return next
}

type Outcome = { ok: true; siteUrl: string; result: ScanResult; via: string } | { ok: false; reason: string }
const perHost = new Map<string, Promise<Outcome>>()

async function scanOne(site: string): Promise<Outcome> {
  await sleep(250)
  try {
    const s = await fetchSite(site)
    let result = scanBrand(s.html, s.stylesheets, s.hints)
    let via = 'page and stylesheets'
    if (!result.pair && flag('--browser')) { result = await browserScan(s.siteUrl); via = 'a real browser' }
    return result.pair ? { ok: true, siteUrl: s.siteUrl, result, via } : { ok: false, reason: 'no_colors' }
  } catch (e) {
    const msg = (e as Error).message
    if (/answered (401|403|429|5)/.test(msg) && flag('--browser')) {
      try {
        const result = await browserScan(site)
        if (result.pair) return { ok: true, siteUrl: site, result, via: 'a real browser' }
      } catch { /* falls through */ }
      return { ok: false, reason: 'refused' }
    }
    return { ok: false, reason: /answered/.test(msg) ? 'refused' : 'unreachable' }
  }
}

function scanHost(site: string): Promise<Outcome> {
  const host = new URL(site).hostname.replace(/^www\./, '')
  const known = perHost.get(host)
  if (known) return known
  const p = scanOne(site)
  perHost.set(host, p)
  return p
}

async function main() {
  const kind = arg('--kind') as OrgBrandKind | undefined
  if (!kind || !['WORKFORCE_BOARD', 'JOB_CENTER', 'ECON_DEV', 'COLLEGE'].includes(kind)) {
    console.log('usage: scan-orgs.ts --kind WORKFORCE_BOARD|JOB_CENTER|ECON_DEV|COLLEGE [--ids a,b] [--limit N] [--apply] [--browser] [--force] [--concurrency 4]')
    return
  }
  const ids = (arg('--ids') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const apply = flag('--apply')
  let list = await loadTargets(kind, ids)
  if (!ids.length) {
    const [done, missed] = await Promise.all([brandedIds(kind), brandMissIds(kind)])
    list = list.filter((t) => !done.has(t.id) && !missed.has(t.id))
  }
  const limit = Number(arg('--limit') ?? 0)
  if (limit) list = list.slice(0, limit)
  console.log(`${kind}: ${list.length} to scan${apply ? '' : ' (dry run: nothing saved)'}`)
  let ok = 0, i = 0
  const misses: Record<string, number> = {}
  async function worker() {
    while (i < list.length) {
      const t = list[i++]
      if (t.sites.length === 0) { misses.no_site = (misses.no_site ?? 0) + 1; if (apply) await recordBrandMiss(kind!, t.id, 'no_site'); continue }
      let out: Outcome = { ok: false, reason: 'no_colors' }
      for (const site of t.sites.slice(0, 2)) {
        out = await scanHost(site)
        if (out.ok) break
      }
      if (out.ok) {
        ok++
        const p = out.result.pair!
        console.log(`✓ ${t.name}  ${out.siteUrl}  ${p.primary} / ${p.secondary}${p.secondaryDerived ? ' (derived)' : ''}  [${out.via}]`)
        if (apply) {
          const existing = await getOrgBrand(kind!, t.id)
          if (existing?.source === 'MANUAL' && !flag('--force')) console.log('  colors were set by hand; left alone')
          else await saveOrgBrand({ kind: kind!, sourceId: t.id, siteUrl: out.siteUrl, pair: p, candidates: out.result.candidates, source: 'SCAN' })
        }
      } else {
        misses[out.reason] = (misses[out.reason] ?? 0) + 1
        if (apply) await recordBrandMiss(kind!, t.id, out.reason)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Number(arg('--concurrency') ?? 4)) }, worker))
  console.log(`\nread ${ok} of ${list.length}. not read: ${JSON.stringify(misses)}`)
  await browser?.close()
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
