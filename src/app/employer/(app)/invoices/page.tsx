import { requireOutplacementRole } from '@/lib/employer/outplacement-auth'
import { getOrgInvoiceInfo } from '@/lib/employer/outplacement-billing'

const TIER_LABEL: Record<string, string> = { CORE: 'Core', PLUS: 'Plus', PREMIUM: 'Premium' }

function fmtMoney(cents: number | null) {
  if (cents == null) return '—'
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmt(d: Date) {
  return new Date(d).toLocaleDateString()
}

export default async function EmployerInvoicesPage() {
  const orgUser = await requireOutplacementRole(['ADMIN', 'FINANCE'])
  const contracts = await getOrgInvoiceInfo(orgUser)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Contract totals, PO references, and invoice references. This reflects contract terms only —
          billing isn&apos;t automated yet, so treat this as a reference alongside your invoice from
          NextChapter, not a payment portal.
        </p>
      </div>

      {contracts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No contracts on file.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                <th className="px-3 py-2 font-medium">Contract</th>
                <th className="px-3 py-2 font-medium">Tier</th>
                <th className="px-3 py-2 font-medium">Seats</th>
                <th className="px-3 py-2 font-medium">Per seat</th>
                <th className="px-3 py-2 font-medium">Total</th>
                <th className="px-3 py-2 font-medium">Term</th>
                <th className="px-3 py-2 font-medium">PO ref</th>
                <th className="px-3 py-2 font-medium">Invoice ref</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <tr key={c.contractId} className="border-t border-border">
                  <td className="px-3 py-2">{c.cohortLabel ?? '—'}</td>
                  <td className="px-3 py-2">{TIER_LABEL[c.tier]}</td>
                  <td className="px-3 py-2 tabular-nums">{c.seatCount}</td>
                  <td className="px-3 py-2 tabular-nums">{fmtMoney(c.pricePerSeatCents)}</td>
                  <td className="px-3 py-2 tabular-nums">{fmtMoney(c.totalCents)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {fmt(c.termStartAt)} – {fmt(c.termEndAt)}
                  </td>
                  <td className="px-3 py-2">{c.poReference ?? '—'}</td>
                  <td className="px-3 py-2">{c.invoiceReference ?? '—'}</td>
                  <td className="px-3 py-2">{c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
