import 'server-only'
import { prisma } from '@/lib/prisma'
import { EXTRA_COMPETITORS, awardUrl, matchAwards, searchNames, type RawAward } from './awards'

// Looks up federal contracts and grants (USAspending.gov — free, no key, no AI) won by each competitor,
// one request at a time. Competitors are taken least-recently-checked first and the run stops at its own
// deadline; each is re-checked every two weeks.
const API = 'https://api.usaspending.gov/api/v2/search/spending_by_award/'
const RECHECK_MS = 14 * 86_400_000
const GAP_MS = 400
const CONTRACT_CODES = ['A', 'B', 'C', 'D']
const GRANT_CODES = ['02', '03', '04', '05']

async function fetchPage(name: string, codes: string[], from: string, to: string, page: number): Promise<{ rows: RawAward[]; hasNext: boolean }> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filters: { recipient_search_text: [name], award_type_codes: codes, time_period: [{ start_date: from, end_date: to }] },
      fields: ['Award ID', 'Recipient Name', 'Award Amount', 'Awarding Agency', 'Awarding Sub Agency', 'Start Date', 'End Date', 'Description', 'generated_internal_id'],
      limit: 100, page, sort: 'Award Amount', order: 'desc',
    }),
    signal: AbortSignal.timeout(25_000),
  })
  if (!res.ok) throw new Error(`USAspending ${res.status}`)
  const json = (await res.json()) as { results?: Record<string, unknown>[]; page_metadata?: { hasNext?: boolean } }
  const rows = (json.results ?? []).map((r) => ({
    generatedId: (r['generated_internal_id'] as string) ?? null,
    awardId: (r['Award ID'] as string) ?? null,
    recipient: String(r['Recipient Name'] ?? ''),
    amount: Number(r['Award Amount'] ?? 0),
    agency: (r['Awarding Agency'] as string) ?? null,
    subAgency: (r['Awarding Sub Agency'] as string) ?? null,
    description: (r['Description'] as string) ?? null,
    startDate: (r['Start Date'] as string) ?? null,
    endDate: (r['End Date'] as string) ?? null,
  }))
  return { rows, hasNext: !!json.page_metadata?.hasNext }
}

// Up to three pages (300 awards) per name and award type; a name with more than that is a big federal
// contractor and its biggest awards are the ones that matter.
async function fetchAwards(name: string, codes: string[], from: string, to: string): Promise<RawAward[]> {
  const out: RawAward[] = []
  for (let page = 1; page <= 3; page++) {
    const r = await fetchPage(name, codes, from, to, page)
    out.push(...r.rows)
    if (!r.hasNext) break
    await new Promise((x) => setTimeout(x, GAP_MS))
  }
  return out
}

export interface AwardSyncResult {
  considered: number
  checked: number
  withAwards: number
  newAwards: number
  failed: number
  stoppedEarly: boolean
  newAwardList: { competitor: string; kind: string; agency: string | null; amount: number; startDate: string | null; url: string; confidence: string }[]
}

export async function syncCompetitorAwards(opts: { limit?: number; deadlineMs?: number; dryRun?: boolean; names?: string[] } = {}): Promise<AwardSyncResult> {
  const started = Date.now()
  const now = new Date()
  const to = now.toISOString().slice(0, 10)
  const from = new Date(now.getTime() - 5 * 365 * 86_400_000).toISOString().slice(0, 10)
  const res: AwardSyncResult = { considered: 0, checked: 0, withAwards: 0, newAwards: 0, failed: 0, stoppedEarly: false, newAwardList: [] }

  const comps = await prisma.productCompetitor.findMany({ select: { id: true, name: true } })
  const idByName = new Map(comps.map((c) => [c.name, c.id]))
  const all = [...new Set([...comps.map((c) => c.name), ...EXTRA_COMPETITORS])]
  const checks = new Map((await prisma.competitorAwardCheck.findMany()).map((c) => [c.competitorName, c.checkedAt.getTime()]))

  const due = (opts.names ?? all)
    .filter((n) => opts.names || now.getTime() - (checks.get(n) ?? 0) > RECHECK_MS)
    .sort((a, b) => (checks.get(a) ?? 0) - (checks.get(b) ?? 0))
  res.considered = due.length

  for (const name of due.slice(0, opts.limit ?? due.length)) {
    if (opts.deadlineMs && Date.now() - started > opts.deadlineMs) { res.stoppedEarly = true; break }
    try {
      const matched = []
      for (const sn of searchNames(name)) {
        for (const [kind, codes] of [['CONTRACT', CONTRACT_CODES], ['GRANT', GRANT_CODES]] as const) {
          const raw = await fetchAwards(sn, codes, from, to)
          matched.push(...matchAwards(name, kind, raw))
          await new Promise((r) => setTimeout(r, GAP_MS))
        }
      }
      const unique = new Map(matched.filter((m) => m.startDate && m.startDate >= from).map((m) => [m.generatedId as string, m]))
      res.checked++
      if (unique.size > 0) res.withAwards++
      if (opts.dryRun) {
        for (const m of unique.values()) res.newAwardList.push({ competitor: name, kind: m.kind, agency: m.agency, amount: m.amount, startDate: m.startDate, url: awardUrl(m.generatedId as string), confidence: m.confidence })
        continue
      }
      const have = new Set((await prisma.competitorAward.findMany({ where: { competitorName: name }, select: { awardKey: true } })).map((a) => a.awardKey))
      for (const m of unique.values()) {
        const awardKey = m.generatedId as string
        const data = {
          recipientName: m.recipient, kind: m.kind, confidence: m.confidence, awardId: m.awardId,
          description: m.description?.slice(0, 600) ?? null, agency: m.agency, subAgency: m.subAgency, amount: m.amount,
          startDate: m.startDate ? new Date(m.startDate) : null, endDate: m.endDate ? new Date(m.endDate) : null,
          url: awardUrl(awardKey), lastSeenAt: now, competitorId: idByName.get(name) ?? null,
        }
        await prisma.competitorAward.upsert({
          where: { awardKey_competitorName: { awardKey, competitorName: name } },
          create: { id: `${awardKey}:${name}`, awardKey, competitorName: name, ...data },
          update: data,
        })
        if (!have.has(awardKey)) {
          res.newAwards++
          res.newAwardList.push({ competitor: name, kind: m.kind, agency: m.agency, amount: m.amount, startDate: m.startDate, url: data.url, confidence: m.confidence })
        }
      }
      await prisma.competitorAwardCheck.upsert({
        where: { competitorName: name },
        create: { competitorName: name, awardsFound: unique.size },
        update: { checkedAt: now, awardsFound: unique.size, error: null },
      })
    } catch (e) {
      res.failed++
      if (!opts.dryRun) {
        await prisma.competitorAwardCheck.upsert({
          where: { competitorName: name },
          create: { competitorName: name, awardsFound: 0, error: String(e).slice(0, 200) },
          update: { checkedAt: now, error: String(e).slice(0, 200) },
        })
      }
    }
  }
  return res
}
