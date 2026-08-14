import type { StructuralCorrelationRow } from '@/lib/admin/structural-correlation'
import { isSuppressedCell, type MaybeSuppressed } from '@/lib/admin/cell-suppression'

export function StructuralCorrelationTable({
  title,
  rows,
}: {
  title: string
  rows: MaybeSuppressed<StructuralCorrelationRow>[]
}) {
  if (rows.length === 0) return null

  return (
    <div>
      <h3 className="text-xs font-semibold tracking-widest text-brand uppercase">{title}</h3>
      <div className="mt-3 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-4 py-2 font-medium">Segment</th>
              <th className="px-4 py-2 font-medium">Candidates</th>
              <th className="px-4 py-2 font-medium">Approved-offer rate</th>
              <th className="px-4 py-2 font-medium">Grade distribution</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) =>
              isSuppressedCell(row) ? (
                <tr key={row.label} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 text-foreground">{row.label}</td>
                  <td colSpan={3} className="px-4 py-2 text-muted-foreground">
                    Insufficient data (fewer than 5 candidates)
                  </td>
                </tr>
              ) : (
                <tr key={row.label} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 text-foreground">{row.label}</td>
                  <td className="px-4 py-2 tabular-nums text-foreground">{row.candidateCount}</td>
                  <td className="px-4 py-2 tabular-nums text-muted-foreground">
                    {row.approvedOfferRate === null ? '—' : `${row.approvedOfferRate}%`}
                  </td>
                  <td className="px-4 py-2 tabular-nums text-muted-foreground">{row.gradeDistribution}</td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
