import { getPlanCatalogHistory } from '@/lib/admin/plan-catalog'
import { PLAN_KEYS, PLAN_LABELS, PLAN_CATEGORY_LABELS, BILLING_PERIOD_LABELS } from '@/lib/constants/plan-catalog'
import { requireAdmin } from '@/lib/admin/auth'
import { createPlanCatalogRow } from './actions'
import { PlanCatalogForm } from '@/components/admin/PlanCatalogForm'
import { Card, CardContent } from '@/components/ui/card'

function formatCents(cents: number) {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: cents % 100 === 0 ? 0 : 2 })}`
}

export default async function PlanCatalogAdminPage() {
  await requireAdmin()
  const history = await getPlanCatalogHistory()

  return (
    <div className="mx-auto max-w-5xl space-y-10 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Plan catalog</h1>
        <p className="mt-1 text-muted-foreground">
          Source of truth for every priced plan — Master Build Script §A9. Versioned by effective date, same rule as
          the coaching rate card: adding a version never edits history. No live Stripe integration reads this yet
          (that&apos;s real payment infrastructure — flagged as a follow-up); this is the catalog data itself,
          seeded with the spec&apos;s published prices, ready for a marketing pricing page or checkout flow to read
          from instead of hardcoding a price in JSX.
        </p>
      </div>

      <PlanCatalogForm action={createPlanCatalogRow} />

      {PLAN_KEYS.map((key) => {
        const rows = history[key] ?? []
        const current = rows.find((r) => r.isCurrent)
        const past = rows.filter((r) => !r.isCurrent)
        return (
          <div key={key} className="space-y-3">
            <h2 className="text-base font-semibold tracking-tight">{PLAN_LABELS[key]}</h2>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Not seeded yet.</p>
            ) : (
              <>
                {current && (
                  <Card>
                    <CardContent className="pt-6">
                      <p className="font-medium">
                        {current.name}
                        <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                          Current
                        </span>
                        {!current.active && (
                          <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            Inactive
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatCents(current.priceCents)} · {BILLING_PERIOD_LABELS[current.billingPeriod]}
                        {current.termMonths && <> · {current.termMonths}-month term</>} · effective{' '}
                        {current.effectiveDate.toLocaleDateString()} · {PLAN_CATEGORY_LABELS[current.category]}
                      </p>
                      {Array.isArray(current.features) && (current.features as string[]).length > 0 && (
                        <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
                          {(current.features as string[]).map((f, i) => (
                            <li key={i}>{f}</li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                )}
                {past.length > 0 && (
                  <details className="group">
                    <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
                      {past.length} past version{past.length === 1 ? '' : 's'}
                    </summary>
                    <div className="mt-2 space-y-2">
                      {past.map((row) => (
                        <div key={row.id} className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground">
                          {row.name} — {formatCents(row.priceCents)} · {BILLING_PERIOD_LABELS[row.billingPeriod]} ·
                          effective {row.effectiveDate.toLocaleDateString()} · set by {row.createdBy}
                          {!row.active && ' · inactive'}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
