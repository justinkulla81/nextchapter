import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/auth'
import { functionEcosystem } from '@/lib/crm/ecosystem'
import { FUNCTIONS } from '@/lib/crm/coverage'
import { RecruiterTable } from '@/components/admin/RecruiterTable'
import { SectionTitle } from '@/components/admin/Collapsible'

export const maxDuration = 30

export default async function FunctionPage({ params }: { params: Promise<{ key: string }> }) {
  await requireAdmin()
  const { key } = await params
  if (!FUNCTIONS[key]) notFound()
  const e = await functionEcosystem(key)
  return (
    <div className="space-y-8">
      <header>
        <Link href="/support/admin/crm/functions" className="text-sm text-brand hover:underline">All functions</Link>
        <h1 className="mt-1 text-2xl font-semibold">{FUNCTIONS[key]}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{e.recruiters.total} recruiters · {e.firmCount} search firms whose searches include this function.</p>
      </header>
      <section aria-labelledby="rec" className="space-y-2">
        <SectionTitle id="rec" tone="action">Recruiters</SectionTitle>
        <RecruiterTable rows={e.recruiters.rows} total={e.recruiters.total} empty="No recruiters tagged to this function yet." />
        <Link href={`/support/admin/crm/recruiters?fn=${key}`} className="text-sm text-brand hover:underline">Filter by state</Link>
      </section>
      <section aria-labelledby="firms" className="space-y-2">
        <SectionTitle id="firms">Search firms placing this function</SectionTitle>
        {e.firms.length === 0 ? <p className="text-sm text-muted-foreground">None matched from firms&apos; recent searches.</p> : (
          <ul className="flex flex-wrap gap-2 text-sm">
            {e.firms.map((f) => <li key={f.id}>{f.crmOrgId ? <Link href={`/support/admin/crm/organizations/${f.crmOrgId}`} className="rounded-md border border-border px-2.5 py-1 hover:bg-muted">{f.name}</Link> : <span className="rounded-md border border-border px-2.5 py-1">{f.name}</span>}</li>)}
          </ul>
        )}
      </section>
    </div>
  )
}
