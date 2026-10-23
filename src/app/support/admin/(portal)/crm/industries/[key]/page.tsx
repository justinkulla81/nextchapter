import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/auth'
import { industryEcosystem } from '@/lib/crm/ecosystem'
import { INDUSTRY_KEYS, industryName } from '@/lib/crm/coverage'
import { RecruiterTable } from '@/components/admin/RecruiterTable'

export const maxDuration = 30

export default async function IndustryPage({ params }: { params: Promise<{ key: string }> }) {
  await requireAdmin()
  const { key } = await params
  if (!INDUSTRY_KEYS.includes(key)) notFound()
  const e = await industryEcosystem(key)
  const name = industryName(key)

  return (
    <div className="space-y-8">
      <header>
        <Link href="/support/admin/crm/industries" className="text-sm text-brand hover:underline">All industries</Link>
        <h1 className="mt-1 text-2xl font-semibold capitalize">{name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{e.recruiters.total} recruiters · {e.employerCount} employers in the CRM · {e.openings.toLocaleString('en-US')} open roles · {e.layoffCount} layoff notices ({e.layoffWorkers.toLocaleString('en-US')} workers) in the last 12 months.</p>
      </header>

      <section aria-labelledby="rec" className="space-y-2">
        <h2 id="rec" className="text-lg font-semibold">Recruiters</h2>
        <RecruiterTable rows={e.recruiters.rows} total={e.recruiters.total} empty="No recruiters tagged to this industry yet." />
        <Link href={`/support/admin/crm/recruiters?industry=${key}`} className="text-sm text-brand hover:underline">Filter by state</Link>
      </section>

      <section aria-labelledby="lay" className="space-y-2">
        <h2 id="lay" className="text-lg font-semibold">Largest recent layoffs</h2>
        {e.layoffs.length === 0 ? <p className="text-sm text-muted-foreground">None in this sector.</p> : (
          <ul className="divide-y divide-border rounded-lg border border-border text-sm">
            {e.layoffs.map((n) => (
              <li key={n.id} className="flex flex-wrap justify-between gap-2 px-3 py-2">
                <span className="font-medium">{n.employer}</span>
                <span className="tabular-nums text-muted-foreground">{n.employees ?? '?'} workers · {n.state ?? 'no state'}{n.noticeDate ? ` · ${n.noticeDate.toISOString().slice(0, 10)}` : ''}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="emp" className="space-y-2">
        <h2 id="emp" className="text-lg font-semibold">Employers in the CRM</h2>
        {e.employers.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : (
          <ul className="flex flex-wrap gap-2 text-sm">
            {e.employers.map((o) => <li key={o.id}><Link href={`/support/admin/crm/organizations/${o.id}`} className="rounded-md border border-border px-2.5 py-1 hover:bg-muted">{o.name}{o.usState ? <span className="text-muted-foreground"> ({o.usState})</span> : null}</Link></li>)}
          </ul>
        )}
        {e.employerCount > e.employers.length && <p className="text-xs text-muted-foreground">Top {e.employers.length} of {e.employerCount} by priority.</p>}
      </section>
    </div>
  )
}
