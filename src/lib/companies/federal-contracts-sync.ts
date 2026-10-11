import 'server-only'
import { prisma } from '@/lib/prisma'
import { summarizeFederalAwards, type UsaSpendingAward } from '@/lib/companies/federal-contracts'

// Looks up federal contract awards (USAspending.gov, free, no key) for directory companies
// that have open postings, and stores a summary where the recipient name matches exactly.
// Used by the nightly cron and by scripts/sync-federal-contracts.ts. Skips companies checked
// in the last 30 days; sequential and paced so it stays polite to a public API.
const API = 'https://api.usaspending.gov/api/v2/search/spending_by_award/'
const RECHECK_MS = 30 * 86_400_000

async function fetchAwards(name: string, from: string, to: string): Promise<UsaSpendingAward[]> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filters: {
        recipient_search_text: [name],
        award_type_codes: ['A', 'B', 'C', 'D'],
        time_period: [{ start_date: from, end_date: to }],
      },
      fields: ['Recipient Name', 'Award Amount', 'Awarding Agency', 'Start Date'],
      limit: 100,
      sort: 'Award Amount',
      order: 'desc',
    }),
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`USAspending ${res.status}`)
  const json = (await res.json()) as { results?: Record<string, unknown>[] }
  return (json.results ?? []).map((r) => ({
    recipientName: String(r['Recipient Name'] ?? ''),
    amount: Number(r['Award Amount'] ?? 0),
    agency: (r['Awarding Agency'] as string) ?? null,
    startDate: (r['Start Date'] as string) ?? null,
  }))
}

export interface FederalSyncResult {
  checked: number
  withAwards: number
  failed: number
  stoppedEarly: boolean
}

export async function syncFederalContracts(opts: {
  limit: number
  deadlineMs?: number
  dryRun?: boolean
}): Promise<FederalSyncResult> {
  const started = Date.now()
  const now = new Date()
  const to = now.toISOString().slice(0, 10)
  const from = new Date(now.getTime() - 2 * 365 * 86_400_000).toISOString().slice(0, 10)

  const recentlyChecked = (
    await prisma.federalContractSummary.findMany({
      where: { checkedAt: { gt: new Date(now.getTime() - RECHECK_MS) } },
      select: { companyId: true },
    })
  ).map((r) => r.companyId)

  // Never-checked companies first; a company with no federal work has no row, so the
  // checkedAt gate alone cannot skip it — rotate by id past what this run has handled.
  const companies = await prisma.company.findMany({
    where: { postings: { some: { archivedAt: null } }, id: { notIn: recentlyChecked } },
    select: { id: true, name: true },
    orderBy: { id: 'asc' },
    take: opts.limit,
  })

  const result: FederalSyncResult = { checked: 0, withAwards: 0, failed: 0, stoppedEarly: false }
  for (const c of companies) {
    if (opts.deadlineMs && Date.now() - started > opts.deadlineMs) {
      result.stoppedEarly = true
      break
    }
    try {
      const summary = summarizeFederalAwards(c.name, await fetchAwards(c.name, from, to), from)
      result.checked++
      const data = summary
        ? {
            awards: summary.awards,
            totalAmount: summary.totalAmount,
            topAgency: summary.topAgency,
            latestStart: summary.latestStart ? new Date(summary.latestStart) : null,
            checkedAt: new Date(),
          }
        : // Record "checked, none found" so the next run moves on instead of re-asking.
          { awards: 0, totalAmount: 0, topAgency: null, latestStart: null, checkedAt: new Date() }
      if (summary) result.withAwards++
      if (!opts.dryRun) {
        await prisma.federalContractSummary.upsert({ where: { companyId: c.id }, create: { companyId: c.id, ...data }, update: data })
      }
    } catch {
      result.failed++
    }
    await new Promise((r) => setTimeout(r, 400))
  }
  return result
}
