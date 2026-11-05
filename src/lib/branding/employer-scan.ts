import 'server-only'
import { prisma } from '@/lib/prisma'
import { fetchSite } from './fetch-site'
import { companyHomeOf, guessHosts, pageMatchesCompany } from './company-domain'
import { confidentPair, scanBrand } from './scan'
import { brandMissIds, brandedIds, recordBrandMiss, saveOrgBrand } from './store'
import { looksLikeCompanyName } from './employer-scan-rules'

// Keeps the brand colors of companies up to date, layoff employers first, then the companies with the most open roles. Every day it takes the newest layoff employers that have no colors
// yet (and were not tried in the last 90 days), reads each one's colors from its own website (the same reading as scripts/branding/scan-names.ts:
// the website on file, else addresses guessed from the name, used only when the home page names the company), and saves them as an EMPLOYER
// brand. Until then a layoff page uses NextChapter's fallback pair (fallback.ts), so a new page is never without color. Employers that cannot
// be read are remembered (OrgBrandMiss) and skipped for 90 days. A pair set by hand is never touched (it is already in OrgBrand, so skipped).

const PER_RUN = 40
const DEADLINE_MS = 240_000
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface Target { key: string; name: string }

async function newestLayoffEmployers(): Promise<Target[]> {
  return prisma.$queryRaw<Target[]>`
    SELECT "normalizedEmployer" AS key, (array_agg(employer ORDER BY length(employer), employer))[1] AS name
    FROM "WarnNotice"
    WHERE "dismissedAt" IS NULL AND "normalizedEmployer" IS NOT NULL AND "normalizedEmployer" <> ''
    GROUP BY "normalizedEmployer"
    ORDER BY max("noticeDate") DESC
    LIMIT 600`
}

/** Companies with the most open roles on the board, most first: the next ones to color once the layoff employers all have colors. */
async function mostHiring(): Promise<Target[]> {
  return prisma.$queryRaw<Target[]>`
    SELECT c."canonicalNameNormalized" AS key, c.name AS name
    FROM "ExclusiveJobPosting" j JOIN "Company" c ON c.id = j."companyId"
    WHERE j.status = 'approved' AND j."archivedAt" IS NULL AND c."canonicalNameNormalized" IS NOT NULL
    GROUP BY c.id, c.name, c."canonicalNameNormalized"
    ORDER BY count(*) DESC
    LIMIT 800`
}

async function read(t: Target): Promise<{ siteUrl: string; pair: NonNullable<ReturnType<typeof confidentPair>>; candidates: ReturnType<typeof scanBrand>['candidates'] } | string> {
  const company = await prisma.company.findUnique({ where: { canonicalNameNormalized: t.key }, select: { website: true } }).catch(() => null)
  const curated = [companyHomeOf(company?.website)].filter((s): s is string => !!s)
  const candidates = [...curated.map((url) => ({ url, verify: false })), ...guessHosts(t.name).slice(0, 4).map((h) => ({ url: `https://${h}`, verify: true }))]
  if (candidates.length === 0) return 'no_site'
  let weak = false
  let unverified = false
  for (const c of candidates) {
    await sleep(200)
    try {
      const site = await fetchSite(c.url)
      if (c.verify && !pageMatchesCompany(t.name, site.html)) { unverified = true; continue }
      const result = scanBrand(site.html, site.stylesheets, site.hints)
      const pair = confidentPair(result)
      if (pair) return { siteUrl: site.siteUrl, pair, candidates: result.candidates }
      weak = true
    } catch { /* try the next address */ }
  }
  return weak ? 'weak' : unverified ? 'unverified' : 'no_colors'
}

export async function runEmployerBrandScan(): Promise<Record<string, number>> {
  const startedAt = Date.now()
  const [done, missed, layoffs] = await Promise.all([brandedIds('EMPLOYER'), brandMissIds('EMPLOYER'), newestLayoffEmployers()])
  const seen = new Set<string>()
  const pending = (list: Target[]) => list.filter((t) => !done.has(t.key) && !missed.has(t.key) && !seen.has(t.key) && seen.add(t.key))
  let all = pending(layoffs)
  // Layoff employers first; with room left in this run, the companies hiring the most.
  if (all.length < PER_RUN) all = [...all, ...pending(await mostHiring())]
  const todo = all.slice(0, PER_RUN)
  let saved = 0
  let notRead = 0
  for (const t of todo) {
    if (Date.now() - startedAt > DEADLINE_MS) break
    if (!looksLikeCompanyName(t.name)) { await recordBrandMiss('EMPLOYER', t.key, 'not_a_company').catch(() => {}); continue }
    const out = await read(t).catch(() => 'error')
    if (typeof out === 'string') {
      notRead++
      if (out !== 'error') await recordBrandMiss('EMPLOYER', t.key, out).catch(() => {})
      continue
    }
    await saveOrgBrand({ kind: 'EMPLOYER', sourceId: t.key, siteUrl: out.siteUrl, pair: out.pair, candidates: out.candidates, source: 'SCAN' })
    saved++
  }
  return { tried: todo.length, saved, notRead, waiting: Math.max(0, all.length - todo.length) }
}
