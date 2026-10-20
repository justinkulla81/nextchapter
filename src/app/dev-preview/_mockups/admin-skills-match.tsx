import { SkillsMatchReport } from '@/components/admin/SkillsMatchReport'
import { buildSkillMatchReport, type AggregateRow } from '@/lib/applications/skill-match-aggregate'

// The admin skills-match report (support/admin/jobs/skills-match), the code that ships, fed sample rows
// shaped like production's snapshots (mostly inferred, a few from postings, several members and states).
const NOW = new Date('2026-10-20T12:00:00Z')
const FUNCS = ['Finance', 'Fundraising & development', 'Executive Leadership', 'Investment', 'Strategy']
const INDS = ['financial_services', 'healthcare', 'technology', null, 'nonprofit']
const LEVELS = ['DIRECTOR', 'VP', 'C_SUITE', 'HEAD', 'MANAGER']
const STATES: [string | null, string | null][] = [['NY', 'Northeast'], ['MA', 'Northeast'], ['TX', 'South'], ['CA', 'West'], [null, null], ['IL', 'Midwest']]
const GAPS = [['excel', 'forecasting', 'budgeting'], ['crm', 'strategic planning', 'salesforce'], ['risk management', 'audit', 'treasury'], ['financial modeling', 'due diligence', 'AI governance and risk'], ['sql', 'project management']]

function sampleRows(): AggregateRow[] {
  const rows: AggregateRow[] = []
  for (let i = 0; i < 64; i++) {
    const k = i % 5
    const [state, region] = STATES[i % STATES.length]
    rows.push({
      candidateId: `m${i % 7}`,
      appliedAt: new Date(NOW.getTime() - (i * 1.3 + 1) * 86_400_000),
      basis: i % 6 === 0 ? 'posting' : 'inferred',
      matchPct: i % 11 === 0 ? null : (i * 17) % 90,
      missing: GAPS[k].slice(0, 1 + (i % 3)),
      industry: INDS[k],
      jobFunction: FUNCS[(i + 1) % 5],
      level: LEVELS[i % 5],
      locationState: state,
      region,
    })
  }
  return rows
}

export function AdminSkillsMatch() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 bg-background p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Skills match and gaps in applications (sample data)</h1>
      <SkillsMatchReport
        report={buildSkillMatchReport(sampleRows(), NOW)}
        members={[
          { candidateId: 'm0', name: 'Sample member', applications: 45, matchPct: 24 },
          { candidateId: 'm1', name: 'Another member', applications: 12, matchPct: 51 },
        ]}
      />
    </div>
  )
}
