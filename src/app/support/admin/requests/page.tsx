import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { listAllAuthUsers } from '@/lib/admin/auth-users'
import { getAdminRequests, type AdminRequestRow } from '@/lib/admin/requests'
import { AdminDataTable, type AdminColumn } from '@/components/admin/AdminDataTable'
import { AdminFilterBar } from '@/components/admin/AdminFilterBar'
import { markJobBoardIntroRequestStatus } from './actions'

export const maxDuration = 30

const TYPE_LABEL: Record<AdminRequestRow['type'], string> = {
  coaching: 'Premium coaching',
  recruiter_opt_in: 'Recruiter opt-in',
  reference_dispute: 'Reference dispute',
  bounty_claim: 'Offer Bonus claim',
  job_board_intro: 'Job Board intro',
}

export default async function AdminRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdmin()
  const params = await searchParams
  const typeFilter = params.type ?? ''
  const q = (params.q ?? '').toLowerCase().trim()

  const authUsers = await listAllAuthUsers()
  let rows = await getAdminRequests(authUsers)

  if (typeFilter) rows = rows.filter((r) => r.type === typeFilter)
  if (q) {
    rows = rows.filter(
      (r) => r.candidateName.toLowerCase().includes(q) || r.candidateEmail.toLowerCase().includes(q)
    )
  }

  const columns: AdminColumn<AdminRequestRow>[] = [
    { header: 'Type', render: (r) => TYPE_LABEL[r.type] },
    {
      header: 'Candidate',
      render: (r) =>
        r.detailHref === '#' ? (
          r.candidateName
        ) : (
          <Link href={r.detailHref} className="text-primary underline underline-offset-4">
            {r.candidateName}
          </Link>
        ),
    },
    { header: 'Email', render: (r) => r.candidateEmail },
    { header: 'Summary', render: (r) => r.summary },
    { header: 'Status', render: (r) => r.status },
    {
      header: 'Requested',
      className: 'px-3 py-2 font-medium tabular-nums',
      render: (r) => r.requestedAt.toLocaleDateString(),
    },
    {
      header: 'Actions',
      render: (r) =>
        r.type === 'job_board_intro' && r.status === 'pending' ? (
          <div className="flex gap-2">
            <form action={markJobBoardIntroRequestStatus.bind(null, r.id.replace('intro-', ''), 'contacted')}>
              <button type="submit" className="text-sm text-primary underline underline-offset-4">
                Mark contacted
              </button>
            </form>
            <form action={markJobBoardIntroRequestStatus.bind(null, r.id.replace('intro-', ''), 'closed')}>
              <button type="submit" className="text-sm text-muted-foreground underline underline-offset-4">
                Close
              </button>
            </form>
          </div>
        ) : (
          <Link href={r.detailHref} className="text-sm text-muted-foreground underline underline-offset-4">
            {r.detailHref.startsWith('/support/admin/candidates') ? 'View candidate' : 'Go to source page'}
          </Link>
        ),
    },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Requests</h1>
        <p className="mt-1 text-muted-foreground">
          Everything candidates have asked for, in one place — premium coaching, recruiter visibility
          opt-ins, disputed references, Offer Bonus claims, and Job Board intro requests.
        </p>
      </div>

      <AdminFilterBar
        basePath="/support/admin/requests"
        searchValue={params.q ?? ''}
        searchPlaceholder="Search by name or email…"
        filters={[
          {
            key: 'type',
            label: 'Type',
            value: typeFilter,
            options: Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label })),
          },
        ]}
      />

      <AdminDataTable columns={columns} rows={rows} rowKey={(r) => r.id} emptyMessage="No requests match." />
    </div>
  )
}
