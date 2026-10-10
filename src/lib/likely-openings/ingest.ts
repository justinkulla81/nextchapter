// Daily ingest of SEC EDGAR "likely opening" signals into LikelyOpening.
// Called by /api/cron/likely-openings (last few days) and by
// scripts/backfill-likely-openings.ts (first run: last 60 days).
//
// Idempotent: rows are unique on [accessionNumber, signalType], and filings
// already stored are never re-fetched.

import { prisma } from '@/lib/prisma'
import { displayCompanyName } from '@/lib/text/org-name-match'
import type { LikelyOpeningSignalType } from '@prisma/client'
import { listFilingsForDay, secFetch, filingDocUrl, filingIndexUrl, type EftsHit } from './edgar'
import { htmlToText, extractItem502, readItem502, execSignalsFrom, isNonOperating8kFiler } from './parse-8k'
import { parseFormDXml, judgeFormD, fundingSummary, looksLikeVehicleName } from './parse-form-d'
import { companyKey } from './roles'

export const SIGNAL_TTL_DAYS = 120

export interface IngestStats {
  days: string[]
  eightKSeen: number
  eightK502: number
  eightKFetched: number
  formDSeen: number
  formDFetched: number
  created: Record<LikelyOpeningSignalType, number>
  errors: number
  stoppedEarly: boolean
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function businessDaysBack(days: number, now = new Date()): string[] {
  const out: string[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getTime() - i * 86_400_000)
    const dow = d.getUTCDay()
    if (dow === 0 || dow === 6) continue
    out.push(isoDay(d))
  }
  return out
}

interface Row {
  companyName: string
  companyNameNormalized: string
  cik: string
  signalType: LikelyOpeningSignalType
  roles: string[]
  filingDate: Date
  accessionNumber: string
  filingUrl: string
  summary: string
  amountRaised: number | null
  industry: string | null
  location: string | null
  expiresAt: Date
}

function baseRow(hit: EftsHit, companyName: string) {
  const filingDate = new Date(`${hit.fileDate}T12:00:00Z`)
  return {
    companyName,
    companyNameNormalized: companyKey(companyName),
    cik: hit.cik,
    filingDate,
    accessionNumber: hit.accessionNumber,
    filingUrl: filingIndexUrl(hit),
    location: hit.location,
    expiresAt: new Date(filingDate.getTime() + SIGNAL_TTL_DAYS * 86_400_000),
  }
}

async function alreadyStored(accessions: string[]): Promise<Set<string>> {
  if (accessions.length === 0) return new Set()
  const rows = await prisma.likelyOpening.findMany({
    where: { accessionNumber: { in: accessions } },
    select: { accessionNumber: true },
  })
  return new Set(rows.map((r) => r.accessionNumber))
}

async function save(rows: Row[], stats: IngestStats) {
  if (rows.length === 0) return
  const res = await prisma.likelyOpening.createMany({ data: rows, skipDuplicates: true })
  if (res.count === rows.length) for (const r of rows) stats.created[r.signalType]++
}

/**
 * Pull 8-K Item 5.02 and Form D filings for the last `days` calendar days
 * (weekends skipped) and store the ones that signal a senior opening.
 * `deadline` (epoch ms) stops early and cleanly, so a cron run never times
 * out mid-write; the next run picks up what was missed.
 */
export async function ingestLikelyOpenings({
  days = 3,
  deadline = Number.POSITIVE_INFINITY,
  log = () => {},
}: { days?: number; deadline?: number; log?: (msg: string) => void } = {}): Promise<IngestStats> {
  const stats: IngestStats = {
    days: businessDaysBack(days),
    eightKSeen: 0,
    eightK502: 0,
    eightKFetched: 0,
    formDSeen: 0,
    formDFetched: 0,
    created: { EXEC_DEPARTURE: 0, EXEC_APPOINTMENT: 0, FUNDING_RAISE: 0 },
    errors: 0,
    stoppedEarly: false,
  }
  const outOfTime = () => {
    if (Date.now() > deadline) stats.stoppedEarly = true
    return stats.stoppedEarly
  }

  for (const day of stats.days) {
    if (outOfTime()) break

    // ---- 8-K Item 5.02 -------------------------------------------------
    let eightKs: EftsHit[] = []
    try {
      eightKs = await listFilingsForDay('8-K', day)
    } catch (e) {
      stats.errors++
      log(`8-K list ${day} failed: ${e instanceof Error ? e.message : e}`)
    }
    stats.eightKSeen += eightKs.length
    const with502 = eightKs.filter(
      (h) => h.items.includes('5.02') && !isNonOperating8kFiler(h.companyName, h.sics, h.fileNums)
    )
    stats.eightK502 += with502.length
    const stored8k = await alreadyStored(with502.map((h) => h.accessionNumber))
    for (const hit of with502) {
      if (stored8k.has(hit.accessionNumber) || !hit.fileName) continue
      if (outOfTime()) break
      try {
        const html = await secFetch(filingDocUrl(hit))
        stats.eightKFetched++
        const section = extractItem502(htmlToText(html))
        if (!section) continue
        const name = displayCompanyName(hit.companyName)
        const rows: Row[] = execSignalsFrom(name, readItem502(section)).map((s) => ({
          ...baseRow(hit, name),
          signalType: s.signalType,
          roles: s.roles,
          summary: s.summary,
          amountRaised: null,
          industry: null,
        }))
        await save(rows, stats)
      } catch (e) {
        stats.errors++
        log(`8-K ${hit.accessionNumber} failed: ${e instanceof Error ? e.message : e}`)
      }
    }
    if (outOfTime()) break

    // ---- Form D --------------------------------------------------------
    let formDs: EftsHit[] = []
    try {
      formDs = await listFilingsForDay('D', day)
    } catch (e) {
      stats.errors++
      log(`Form D list ${day} failed: ${e instanceof Error ? e.message : e}`)
    }
    stats.formDSeen += formDs.length
    // Cheap pre-filter on the search index alone (no extra request): funds
    // claim a 3(c) exemption, and SPVs/LPs give themselves away by name.
    const candidates = formDs.filter(
      (h) => !h.items.some((i) => /^3C/i.test(i)) && !looksLikeVehicleName(h.companyName)
    )
    const storedD = await alreadyStored(candidates.map((h) => h.accessionNumber))
    for (const hit of candidates) {
      if (storedD.has(hit.accessionNumber)) continue
      if (outOfTime()) break
      try {
        const xml = await secFetch(filingDocUrl({ ...hit, fileName: hit.fileName || 'primary_doc.xml' }))
        stats.formDFetched++
        const f = parseFormDXml(xml)
        if (!f) continue
        const verdict = judgeFormD(f)
        if (!verdict.keep) continue
        const name = displayCompanyName(f.entityName || hit.companyName)
        await save(
          [
            {
              ...baseRow(hit, name),
              location: f.city && f.state ? `${displayCompanyName(f.city)}, ${f.state}` : hit.location,
              signalType: 'FUNDING_RAISE',
              roles: [],
              summary: fundingSummary(name, f, verdict.amount, verdict.closed),
              amountRaised: verdict.amount,
              industry: f.industryGroupType,
            },
          ],
          stats
        )
      } catch (e) {
        stats.errors++
        log(`Form D ${hit.accessionNumber} failed: ${e instanceof Error ? e.message : e}`)
      }
    }
    log(`${day}: 8-K ${eightKs.length} (5.02: ${with502.length}), D ${formDs.length} (checked ${candidates.length}) — created so far ${JSON.stringify(stats.created)}`)
  }
  return stats
}
