import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { coverageCounts } from '@/lib/crm/ecosystem'
import { INDUSTRY_KEYS, industryKeyForNaics, industryName } from '@/lib/crm/coverage'

export const maxDuration = 30

export default async function IndustriesPage() {
  await requireAdmin()
  const since = new Date(Date.now() - 365 * 86_400_000)
  const [counts, notices, openings] = await Promise.all([
    coverageCounts(),
    prisma.warnNotice.findMany({ where: { dismissedAt: null, noticeDate: { gte: since }, industry: { not: null } }, select: { industry: true, employees: true } }),
    prisma.companyJobOpening.groupBy({ by: ['industry'], where: { closeReason: null }, _count: true }).catch(() => []),
  ])
  const layoffs: Record<string, { n: number; workers: number }> = {}
  for (const n of notices) {
    const k = industryKeyForNaics(n.industry)
    if (!k) continue
    layoffs[k] = { n: (layoffs[k]?.n ?? 0) + 1, workers: (layoffs[k]?.workers ?? 0) + (n.employees ?? 0) }
  }
  const open = Object.fromEntries(openings.map((o) => [o.industry ?? '', o._count]))
  const rows = INDUSTRY_KEYS.map((k) => ({ k, rec: counts.industries[k] ?? 0, open: open[k] ?? 0, lay: layoffs[k] ?? { n: 0, workers: 0 } })).sort((a, b) => b.open - a.open)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Industries</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Each industry with its recruiters, employers, layoffs and open roles. Layoffs are the last 12 months of notices, grouped by the filing&apos;s sector.</p>
      </header>
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-2">Industry</th><th>Recruiters</th><th>Open roles</th><th>Layoff notices</th><th>Workers laid off</th></tr></thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.k}>
              <td className="py-2"><Link href={`/support/admin/crm/industries/${r.k}`} className="font-medium text-brand hover:underline">{industryName(r.k)}</Link></td>
              <td className="tabular-nums">{r.rec}</td><td className="tabular-nums">{r.open.toLocaleString('en-US')}</td>
              <td className="tabular-nums">{r.lay.n}</td><td className="tabular-nums">{r.lay.workers.toLocaleString('en-US')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
