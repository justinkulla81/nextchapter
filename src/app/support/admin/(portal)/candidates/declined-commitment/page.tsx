import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { listAllAuthUsers, getAuthEmail } from '@/lib/admin/auth-users'
import { parseListParams, paginatedResult } from '@/lib/admin/pagination'
import { AdminDataTable, type AdminColumn } from '@/components/admin/AdminDataTable'

export const maxDuration = 30

interface Row {
  id: string
  name: string
  email: string
  declinedAt: string
  registered: boolean
  jobStatus: string | null
}

// Candidates who reached the "I Commit" step and explicitly clicked "Not
// right now" instead of committing (see ContractChoice.tsx) — a real,
// actionable segment for the team to follow up with directly (nudge toward
// finishing account creation, or a different offer/cadence) rather than a
// hard drop-off with no record. contractAcceptedAt is stamped for both
// accept and decline, so filtering to accepted: false, acceptedAt: not null
// is exactly "reached this step and said no," excluding anyone who simply
// hasn't gotten there yet.
export default async function DeclinedCommitmentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdmin()
  const rawParams = await searchParams
  const params = parseListParams(rawParams, [], 25)

  const where = {
    contractAccepted: false,
    contractAcceptedAt: { not: null },
    ...(params.q && {
      OR: [
        { firstName: { contains: params.q, mode: 'insensitive' as const } },
        { lastName: { contains: params.q, mode: 'insensitive' as const } },
      ],
    }),
  }

  const [candidates, total, authUsers] = await Promise.all([
    prisma.candidateProfile.findMany({
      where,
      orderBy: { contractAcceptedAt: 'desc' },
      skip: params.skip,
      take: params.take,
      select: {
        id: true,
        userId: true,
        firstName: true,
        lastName: true,
        contractAcceptedAt: true,
        registrationCompletedAt: true,
        currentJobStatus: true,
      },
    }),
    prisma.candidateProfile.count({ where }),
    listAllAuthUsers(),
  ])

  const rows: Row[] = candidates.map((c) => ({
    id: c.id,
    name: [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Unnamed',
    email: getAuthEmail(authUsers, c.userId),
    declinedAt: c.contractAcceptedAt!.toLocaleDateString(),
    registered: Boolean(c.registrationCompletedAt),
    jobStatus: c.currentJobStatus,
  }))

  const result = paginatedResult(rows, total, params)

  const columns: AdminColumn<Row>[] = [
    {
      header: 'Name',
      render: (r) => (
        <Link href={`/support/admin/candidates/${r.id}`} className="text-primary underline underline-offset-4">
          {r.name}
        </Link>
      ),
    },
    { header: 'Email', render: (r) => r.email },
    { header: 'Declined on', render: (r) => r.declinedAt },
    { header: 'Has account', render: (r) => (r.registered ? 'Yes' : 'No — never finished signup') },
    { header: 'Job status', render: (r) => r.jobStatus ?? '—' },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Declined the commitment</h1>
        <p className="mt-1 text-muted-foreground">
          {total} candidate{total === 1 ? '' : 's'} clicked &ldquo;Not right now&rdquo; instead of committing to the
          weekly effort — a list to follow up with directly (finishing account creation, a different cadence, or
          another offer) rather than a silent drop-off.
        </p>
      </div>

      <AdminDataTable
        columns={columns}
        rows={result.rows}
        rowKey={(r) => r.id}
        emptyMessage="Nobody has declined the commitment."
        pagination={{
          page: result.page,
          totalPages: result.totalPages,
          total: result.total,
          basePath: '/support/admin/candidates/declined-commitment',
          baseParams: { q: params.q },
        }}
      />
    </div>
  )
}
