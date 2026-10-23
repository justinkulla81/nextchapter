import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { coverageCounts } from '@/lib/crm/ecosystem'
import { FUNCTIONS } from '@/lib/crm/coverage'

export const maxDuration = 30

export default async function FunctionsPage() {
  await requireAdmin()
  const counts = await coverageCounts()
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Functions</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Each job function with the recruiters and search firms that place it.</p>
      </header>
      <ul className="grid gap-2 sm:grid-cols-2">
        {Object.entries(FUNCTIONS).map(([k, label]) => (
          <li key={k}><Link href={`/support/admin/crm/functions/${k}`} className="flex justify-between rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"><span className="font-medium">{label}</span><span className="tabular-nums text-muted-foreground">{counts.functions[k] ?? 0} recruiters</span></Link></li>
        ))}
      </ul>
    </div>
  )
}
