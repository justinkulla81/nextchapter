// Looks up federal contract awards (USAspending.gov, free, no key) for directory companies
// that have open postings, and stores a summary where the recipient name matches exactly.
// Re-runnable; skips companies checked in the last 30 days. Polite: sequential, paced.
//
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/sync-federal-contracts.ts [--limit 300] [--dry-run]
import { prisma } from '../src/lib/prisma'
import { summarizeFederalAwards, type UsaSpendingAward } from '../src/lib/companies/federal-contracts'

const API = 'https://api.usaspending.gov/api/v2/search/spending_by_award/'
const arg = (n: string) => {
  const i = process.argv.indexOf(n)
  return i >= 0 ? process.argv[i + 1] : undefined
}

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

async function main() {
  const limit = Number(arg('--limit') ?? 300)
  const dry = process.argv.includes('--dry-run')
  const now = new Date()
  const to = now.toISOString().slice(0, 10)
  const fromDate = new Date(now.getTime() - 2 * 365 * 86_400_000)
  const from = fromDate.toISOString().slice(0, 10)
  const recent = new Date(now.getTime() - 30 * 86_400_000)

  const companies = await prisma.company.findMany({
    where: {
      postings: { some: { archivedAt: null } },
      NOT: { id: { in: (await prisma.federalContractSummary.findMany({ where: { checkedAt: { gt: recent } }, select: { companyId: true } })).map((r) => r.companyId) } },
    },
    select: { id: true, name: true },
    take: limit,
  })

  let found = 0
  for (const c of companies) {
    try {
      const awards = await fetchAwards(c.name, from, to)
      const summary = summarizeFederalAwards(c.name, awards, from)
      if (summary) {
        found++
        if (!dry) {
          const data = {
            awards: summary.awards,
            totalAmount: summary.totalAmount,
            topAgency: summary.topAgency,
            latestStart: summary.latestStart ? new Date(summary.latestStart) : null,
            checkedAt: new Date(),
          }
          await prisma.federalContractSummary.upsert({ where: { companyId: c.id }, create: { companyId: c.id, ...data }, update: data })
        }
      }
    } catch (e) {
      console.error(`${c.name}: ${(e as Error).message}`)
    }
    await new Promise((r) => setTimeout(r, 400))
  }
  console.log(`${companies.length} companies checked; ${found} have federal awards${dry ? ' (dry run)' : ''}`)
}

main().finally(() => prisma.$disconnect())
