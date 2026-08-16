import { requireAdmin } from '@/lib/admin/auth'
import { getRecruiterDatabaseRows, bucketRecruiterDatabaseRows, type RecruiterDatabaseRow } from '@/lib/admin/recruiter-database'
import { AdminDataTable, type AdminColumn } from '@/components/admin/AdminDataTable'
import { AdminFilterBar } from '@/components/admin/AdminFilterBar'
import { RecruiterDatabaseActionButton } from '@/components/admin/RecruiterDatabaseActionButton'

export const maxDuration = 30

function formatDate(d: Date | null): string {
  return d ? d.toLocaleDateString() : '—'
}

function baseColumns(): AdminColumn<RecruiterDatabaseRow>[] {
  return [
    { header: 'Name', render: (r) => r.name },
    { header: 'Email', render: (r) => r.email },
    { header: 'Function', render: (r) => r.primaryFunction },
    { header: 'Level', render: (r) => r.level },
    { header: 'Target role', render: (r) => r.targetRoleType },
    { header: 'Industry', render: (r) => r.industry },
    {
      header: 'Geo',
      render: (r) => (
        <div>
          <div>{r.geo}</div>
          <div className="text-xs text-muted-foreground">{r.geoFlex}</div>
        </div>
      ),
    },
    { header: 'Resume Score', render: (r) => (r.resumeScore !== null ? `${r.resumeScore}/100` : '—') },
    {
      header: 'Sprint Target',
      render: (r) =>
        r.onSprintTarget ? (
          <span className="rounded-full bg-orange/20 px-2 py-0.5 text-xs font-semibold text-orange">
            Sprint Target
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ]
}

export default async function RecruiterDatabaseAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdmin()
  const params = await searchParams
  const q = (params.q ?? '').toLowerCase().trim()

  let rows = await getRecruiterDatabaseRows()
  if (q) {
    rows = rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.primaryFunction.toLowerCase().includes(q) ||
        r.industry.toLowerCase().includes(q) ||
        r.geo.toLowerCase().includes(q)
    )
  }
  const { notified, pendingNotify, lockedButUnlocked, almostThere } = bucketRecruiterDatabaseRows(rows)

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Recruiter Database</h1>
        <p className="mt-1 text-muted-foreground">
          Only opted-in candidates whose Dossier is unlocked, plus the ones close to unlocking — not
          every candidate who&apos;s ever opted in. &ldquo;Requested&rdquo; here means recruiters have
          already been told about this candidate, not that a recruiter asked for them by name.
        </p>
      </div>

      <AdminFilterBar
        basePath="/support/admin/recruiter-database"
        searchValue={params.q ?? ''}
        searchPlaceholder="Search by name, email, function, industry, geo…"
      />

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Unlocked &amp; requested</h2>
          <p className="text-sm text-muted-foreground">
            Opted in, Dossier unlocked, and recruiters have already been notified. {notified.length}{' '}
            candidate{notified.length === 1 ? '' : 's'}.
          </p>
        </div>
        <AdminDataTable
          columns={baseColumns()}
          rows={notified}
          rowKey={(r) => r.id}
          emptyMessage="None yet."
        />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Unlocked, not yet requested</h2>
          <p className="text-sm text-muted-foreground">
            Opted in and Dossier unlocked, but recruiters haven&apos;t been told about them yet — the
            daily cron catches these automatically, or notify now. {pendingNotify.length} candidate
            {pendingNotify.length === 1 ? '' : 's'}.
          </p>
        </div>
        <AdminDataTable
          columns={[
            ...baseColumns(),
            { header: 'Action', render: (r) => <RecruiterDatabaseActionButton candidateId={r.id} action="notify" /> },
          ]}
          rows={pendingNotify}
          rowKey={(r) => r.id}
          emptyMessage="None pending."
        />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Dossier unlocked, still locked out</h2>
          <p className="text-sm text-muted-foreground">
            Dossier is unlocked but haven&apos;t opted into the Recruiter Database — a weekly nudge
            goes out automatically, or nudge now. {lockedButUnlocked.length} candidate
            {lockedButUnlocked.length === 1 ? '' : 's'}.
          </p>
        </div>
        <AdminDataTable
          columns={[
            ...baseColumns(),
            { header: 'Last nudged', render: (r) => formatDate(r.recruiterUnlockNudgedAt) },
            { header: 'Action', render: (r) => <RecruiterDatabaseActionButton candidateId={r.id} action="nudge" /> },
          ]}
          rows={lockedButUnlocked}
          rowKey={(r) => r.id}
          emptyMessage="None right now."
        />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Almost there</h2>
          <p className="text-sm text-muted-foreground">
            Not opted in, 2 of 3 Dossier requirements met — one step away. No automatic nudge (they
            haven&apos;t earned that pitch yet), but you can nudge manually. {almostThere.length}{' '}
            candidate{almostThere.length === 1 ? '' : 's'}.
          </p>
        </div>
        <AdminDataTable
          columns={[
            ...baseColumns(),
            { header: 'Last nudged', render: (r) => formatDate(r.recruiterUnlockNudgedAt) },
            { header: 'Action', render: (r) => <RecruiterDatabaseActionButton candidateId={r.id} action="nudge" /> },
          ]}
          rows={almostThere}
          rowKey={(r) => r.id}
          emptyMessage="None right now."
        />
      </section>
    </div>
  )
}
