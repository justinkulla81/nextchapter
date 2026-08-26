import { COMPETENCY_KEYS, COMPETENCY_KEY_LABEL, type ScorecardComparisonRow } from '@/lib/talent/scorecard-constants'

const RECOMMENDATION_LABEL: Record<string, string> = {
  STRONG_YES: 'Strong yes',
  YES: 'Yes',
  NO: 'No',
  STRONG_NO: 'Strong no',
}

// Ported from src/components/hiring/ScorecardComparisonTable.tsx as part of
// the /hiring -> /talent consolidation — purely presentational, no server
// action coupling, so this moved verbatim aside from the import path.
//
// §A8 — "side-by-side comparison view showing all panelists' scores on
// shared evidence for a candidate."
export function ScorecardComparisonTable({ rows }: { rows: ScorecardComparisonRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No panel set up yet.</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Panelist</th>
            {COMPETENCY_KEYS.map((key) => (
              <th key={key} className="px-3 py-2">
                {COMPETENCY_KEY_LABEL[key]}
              </th>
            ))}
            <th className="px-3 py-2">Recommendation</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.panelistName}>
              <td className="px-3 py-2.5 font-medium text-foreground">
                {row.panelistName}
                {!row.submitted && <span className="ml-2 text-xs text-muted-foreground">Not submitted</span>}
              </td>
              {COMPETENCY_KEYS.map((key) => {
                const entry = row.scores[key]
                const isAssigned = row.assignedCompetency === key
                return (
                  <td key={key} className={`px-3 py-2.5 ${isAssigned ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                    {entry ? `${entry.score}/5` : '—'}
                  </td>
                )
              })}
              <td className="px-3 py-2.5">{row.overallRecommendation ? RECOMMENDATION_LABEL[row.overallRecommendation] : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
