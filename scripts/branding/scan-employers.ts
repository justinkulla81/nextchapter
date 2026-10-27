/**
 * Read employers' brand colors from their own websites and keep them (OrgBrand kind EMPLOYER, keyed by the normalized company name), so the
 * layoff page, the employer page and the job page can use them.
 *
 *   tsx --conditions=react-server --env-file=.env.local scripts/branding/scan-employers.ts --set layoffs [--limit 200] [--apply] [--browser]
 *   ... --set top --limit 500        employers with the most open roles
 *   ... --names "Intel,Amazon"       these companies only
 *
 * For each company it tries, in order: the website on file (Company, then the CRM), the domain Hunter found (~/nc-hunter-results), then
 * addresses guessed from the name. A guessed address is used only when its home page names the company (src/lib/branding/company-domain.ts).
 * Companies that cannot be read are remembered (OrgBrandMiss) and skipped for 90 days. Several sites at a time, never the same site twice at
 * once; a short pause between requests.
 */
import { readFileSync, existsSync } from 'node:fs'
import { chromium, type Browser } from 'playwright'
import { prisma } from '../../src/lib/prisma'
import { fetchSite } from '../../src/lib/branding/fetch-site'
import { companyHomeOf, guessHosts, pageMatchesCompany } from '../../src/lib/branding/company-domain'
import { confidentPair, scanBrand, scanComputedColors, type ScanResult } from '../../src/lib/branding/scan'
import { brandMissIds, brandedIds, employerBrandKey, recordBrandMiss, saveOrgBrand } from '../../src/lib/branding/store'
import { getCompanies } from '../../src/lib/warn/layoff-pages'

const arg = (n: string) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined }
const flag = (n: string) => process.argv.includes(n)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const CONCURRENCY = Number(arg('--concurrency') ?? 4)

interface Target { name: string; key: string }

async function targets(): Promise<Target[]> {
  const set = arg('--set')
  const names = (arg('--names') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  let list: string[] = names
  if (set === 'layoffs') list = [...(await getCompanies()).values()].map((c) => c.name)
  if (set === 'top') {
    const n = Number(arg('--limit') ?? 500)
    const rows = await prisma.$queryRawUnsafe<{ name: string }[]>(
      `SELECT c.name FROM "ExclusiveJobPosting" j JOIN "Company" c ON c.id = j."companyId"
        WHERE j.status = 'approved' AND j."archivedAt" IS NULL GROUP BY c.id, c.name ORDER BY count(*) DESC LIMIT ${Math.max(1, Math.min(5000, n))}`,
    )
    list = rows.map((r) => r.name)
  }
  const seen = new Set<string>()
  const out: Target[] = []
  for (const name of list) {
    const key = employerBrandKey(name)
    if (key && !seen.has(key)) { seen.add(key); out.push({ name, key }) }
  }
  return out
}

/** Hunter's domain per company name, from the files already on disk. */
function hunterDomains(): Map<string, string> {
  const map = new Map<string, string>()
  for (const f of ['10-hunter-hr.json', '20-hunter-people.json', '17-buyers-hunter.json', '19-buyers-hunter-set2.json']) {
    const path = `/Users/salitkulla/nc-hunter-results/${f}`
    if (!existsSync(path)) continue
    try {
      for (const r of JSON.parse(readFileSync(path, 'utf8')) as { org?: string; name?: string; domain?: string }[]) {
        const org = r.org ?? r.name
        if (org && r.domain && !r.domain.includes(' ')) map.set(employerBrandKey(org), r.domain)
      }
    } catch { /* a file that does not parse is skipped */ }
  }
  return map
}

async function onFile(key: string): Promise<string[]> {
  const company = await prisma.company.findUnique({ where: { canonicalNameNormalized: key }, select: { website: true } }).catch(() => null)
  const crm = await prisma.crmOrganization.findUnique({ where: { canonicalNameNormalized: key }, select: { website: true, emailDomain: true } }).catch(() => null)
  return [company?.website, crm?.website, crm?.emailDomain].map((s) => companyHomeOf(s)).filter((s): s is string => !!s)
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

async function resolve(t: Target, hunter: Map<string, string>): Promise<Outcome> {
  const curated = [...(await onFile(t.key)), ...(hunter.has(t.key) ? [companyHomeOf(hunter.get(t.key))!].filter(Boolean) : [])]
  const guesses = guessHosts(t.name).map((h) => `https://${h}`)
  const candidates: { url: string; verify: boolean }[] = [...new Set(curated)].map((url) => ({ url, verify: false }))
  for (const g of guesses) if (!candidates.some((c) => c.url.replace('www.', '') === g)) candidates.push({ url: g, verify: true })
  if (candidates.length === 0) return { ok: false, reason: 'no_site' }
  let sawRefusal = false
  let sawUnverified = false
  let sawWeak = false
  for (const c of candidates.slice(0, 5)) {
    await sleep(250)
    try {
      const site = await fetchSite(c.url)
      if (c.verify && !pageMatchesCompany(t.name, site.html)) { sawUnverified = true; continue }
      let result = scanBrand(site.html, site.stylesheets, site.hints)
      let via = 'page and stylesheets'
      if (!confidentPair(result) && flag('--browser')) { result = await browserScan(site.siteUrl); via = 'a real browser' }
      const pair = confidentPair(result)
      if (pair) return { ok: true, siteUrl: site.siteUrl, result: { ...result, pair }, via }
      if (result.pair) sawWeak = true
    } catch (e) {
      const msg = (e as Error).message
      if (/answered (401|403|429|5)/.test(msg)) {
        sawRefusal = true
        if (flag('--browser')) {
          try {
            const html = c.verify ? await browserHtml(c.url) : ''
            if (c.verify && !pageMatchesCompany(t.name, html)) { sawUnverified = true; continue }
            const result = await browserScan(c.url)
            const pair = confidentPair(result)
            if (pair) return { ok: true, siteUrl: c.url, result: { ...result, pair }, via: 'a real browser' }
            if (result.pair) sawWeak = true
          } catch { /* fall through to the next candidate */ }
        }
      }
    }
  }
  return { ok: false, reason: sawWeak ? 'weak' : sawRefusal ? 'refused' : sawUnverified ? 'unverified' : 'no_colors' }
}

async function browserHtml(url: string): Promise<string> {
  browser ??= await chromium.launch()
  const page = await browser.newPage()
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(1500)
    return await page.content()
  } finally {
    await page.close()
  }
}

async function main() {
  const apply = flag('--apply')
  const limit = Number(arg('--limit') ?? 0)
  let list = await targets()
  if (list.length === 0) { console.log('usage: scan-employers.ts (--set layoffs|top | --names "A,B") [--limit N] [--apply] [--browser] [--concurrency 4]'); return }
  const [done, missed] = await Promise.all([brandedIds('EMPLOYER'), brandMissIds('EMPLOYER')])
  const before = list.length
  list = list.filter((t) => !done.has(t.key) && !missed.has(t.key))
  if (limit && arg('--set') !== 'top') list = list.slice(0, limit)
  console.log(`${before} companies, ${before - list.length} already done or recently tried, ${list.length} to scan${apply ? '' : ' (dry run: nothing saved)'}`)
  const hunter = hunterDomains()
  let ok = 0
  const misses: Record<string, number> = {}
  let i = 0
  async function worker() {
    while (i < list.length) {
      const t = list[i++]
      const out = await resolve(t, hunter).catch((e) => ({ ok: false as const, reason: `error: ${(e as Error).message.slice(0, 80)}` }))
      if (out.ok) {
        ok++
        const p = out.result.pair!
        console.log(`✓ ${t.name}  ${out.siteUrl}  ${p.primary} / ${p.secondary}${p.secondaryDerived ? ' (derived)' : ''}  [${out.via}]`)
        if (apply) await saveOrgBrand({ kind: 'EMPLOYER', sourceId: t.key, siteUrl: out.siteUrl, pair: p, candidates: out.result.candidates, source: 'SCAN' })
      } else {
        misses[out.reason] = (misses[out.reason] ?? 0) + 1
        if (apply && !out.reason.startsWith('error')) await recordBrandMiss('EMPLOYER', t.key, out.reason)
        if (flag('--verbose')) console.log(`✗ ${t.name}  ${out.reason}`)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, worker))
  console.log(`\nread ${ok} of ${list.length}. not read: ${JSON.stringify(misses)}`)
  await browser?.close()
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
