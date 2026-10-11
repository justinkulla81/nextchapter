import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { defaultRuleSet } from '@/lib/pitch/defaults'
import { CUSTOMER_TYPES, CUSTOMER_LABELS } from '@/lib/pitch/types'

export default async function PitchRulesIndex() {
  await requireAdmin()
  const edited = new Set((await prisma.pitchRuleSet.findMany({ select: { type: true } }).catch(() => [])).map((r) => r.type))
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Pitch rules</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">One rule set per customer type. Switch slides on or off, change the wording, set the offer and price. Every deck built after you save follows the new rules.</p>
        </div>
        <Link href="/support/admin/crm/pitch" className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:opacity-90">Build a pitch</Link>
      </header>
      <ul className="grid gap-3 md:grid-cols-2">
        {CUSTOMER_TYPES.map((t) => {
          const d = defaultRuleSet(t)
          return (
            <li key={t} className="rounded-lg border border-border p-4">
              <div className="flex items-baseline justify-between gap-2">
                <Link href={`/support/admin/crm/pitch-rules/${t}`} className="font-semibold text-brand hover:underline">{CUSTOMER_LABELS[t]}</Link>
                <span className="text-xs text-muted-foreground">{edited.has(t) ? 'Edited' : 'Default'}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{d.angle}</p>
              <p className="mt-2 text-xs text-muted-foreground">Buyer: {d.buyer}</p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
