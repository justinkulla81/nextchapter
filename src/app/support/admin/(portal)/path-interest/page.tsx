import { requireAdmin } from '@/lib/admin/auth'
import { getPathInterestCounts } from '@/lib/admin/path-interest'
import { PARTNERSHIP_MIN_COHORT } from '@/lib/journey/path-interest-counts'
import { INTEREST_KEYS, INTEREST_LABELS, INTEREST_LEVELS } from '@/lib/journey/paths'
import { AdminDataTable, type AdminColumn } from '@/components/admin/AdminDataTable'

export const maxDuration = 30

type Row = { key: (typeof INTEREST_KEYS)[number]; label: string; counts: Record<string, number | null> }

// What members say they are thinking about next to their search, for partnership conversations. Counts only, from members' own
// answers, real members who are not in Confidential Search Mode. A number under the floor is withheld. No names, ids or rows.
export default async function AdminPathInterestPage() {
  await requireAdmin()
  const counts = await getPathInterestCounts()
  const rows: Row[] = INTEREST_KEYS.map((k) => ({ key: k, label: INTEREST_LABELS[k], counts: counts[k] }))
  const cell = (n: number | null | undefined) => (typeof n === 'number' ? n : `Under ${PARTNERSHIP_MIN_COHORT}`)
  const columns: AdminColumn<Row>[] = [
    { header: 'Path', render: (r) => r.label },
    ...INTEREST_LEVELS.map((l) => ({ header: l.label, className: 'px-3 py-2 tabular-nums', render: (r: Row) => cell(r.counts[l.value]) })),
  ]
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">What members are thinking about</h1>
        <p className="mt-1 text-muted-foreground">
          How many members are curious, researching or doing each thing next to their search. Counts of members&apos; own answers only. A number under {PARTNERSHIP_MIN_COHORT} is withheld, and nobody in Confidential Search Mode is counted. Nothing here is sent to any outside party.
        </p>
      </div>
      <AdminDataTable columns={columns} rows={rows} rowKey={(r) => r.key} />
    </div>
  )
}
