import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { AdminDataTable, type AdminColumn } from '@/components/admin/AdminDataTable'

export const maxDuration = 30

interface Row {
  id: string
  fullName: string
  workEmail: string
  firmName: string | null
  specialty: string | null
  hasLogin: boolean
  submissions: number
  createdAt: Date
}

export default async function AdminRecruitersPage() {
  await requireAdmin()

  const recruiters = await prisma.recruiter.findMany({
    where: { isSampleData: false },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      fullName: true,
      workEmail: true,
      firmName: true,
      specialty: true,
      userId: true,
      createdAt: true,
      _count: { select: { jobBoardSubmissions: true } },
    },
  })

  const rows: Row[] = recruiters.map((r) => ({
    id: r.id,
    fullName: r.fullName,
    workEmail: r.workEmail,
    firmName: r.firmName,
    specialty: r.specialty,
    hasLogin: r.userId !== null,
    submissions: r._count.jobBoardSubmissions,
    createdAt: r.createdAt,
  }))

  const columns: AdminColumn<Row>[] = [
    {
      header: 'Name',
      render: (r) => (
        <Link href={`/support/admin/recruiters/${r.id}`} className="text-primary underline underline-offset-4">
          {r.fullName}
        </Link>
      ),
    },
    { header: 'Firm', render: (r) => r.firmName ?? '—' },
    { header: 'Work email', render: (r) => r.workEmail },
    { header: 'Specialty', render: (r) => r.specialty ?? '—' },
    { header: 'Login', render: (r) => (r.hasLogin ? 'Yes' : 'Token-only') },
    { header: 'Submissions', render: (r) => r.submissions },
    { header: 'Joined', className: 'px-3 py-2 font-medium tabular-nums', render: (r) => r.createdAt.toLocaleDateString() },
  ]

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Recruiters</h1>
        <p className="mt-1 text-muted-foreground">{rows.length} recruiter accounts.</p>
      </div>
      <AdminDataTable columns={columns} rows={rows} rowKey={(r) => r.id} emptyMessage="No recruiters yet." />
    </div>
  )
}
