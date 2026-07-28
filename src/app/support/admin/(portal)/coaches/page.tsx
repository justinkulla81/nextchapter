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
  focus: string
  hasLogin: boolean
  clients: number
  createdAt: Date
}

export default async function AdminCoachesPage() {
  await requireAdmin()

  const coaches = await prisma.coach.findMany({
    where: { isSampleData: false },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      fullName: true,
      workEmail: true,
      firmName: true,
      focus: true,
      userId: true,
      createdAt: true,
      _count: { select: { clients: true } },
    },
  })

  const rows: Row[] = coaches.map((c) => ({
    id: c.id,
    fullName: c.fullName,
    workEmail: c.workEmail,
    firmName: c.firmName,
    focus: c.focus,
    hasLogin: c.userId !== null,
    clients: c._count.clients,
    createdAt: c.createdAt,
  }))

  const columns: AdminColumn<Row>[] = [
    {
      header: 'Name',
      render: (r) => (
        <Link href={`/support/admin/coaches/${r.id}`} className="text-primary underline underline-offset-4">
          {r.fullName}
        </Link>
      ),
    },
    { header: 'Firm', render: (r) => r.firmName ?? '—' },
    { header: 'Work email', render: (r) => r.workEmail },
    { header: 'Focus', render: (r) => r.focus },
    { header: 'Login', render: (r) => (r.hasLogin ? 'Yes' : 'Token-only') },
    { header: 'Clients', render: (r) => r.clients },
    { header: 'Joined', className: 'px-3 py-2 font-medium tabular-nums', render: (r) => r.createdAt.toLocaleDateString() },
  ]

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Coaches</h1>
        <p className="mt-1 text-muted-foreground">{rows.length} coach accounts.</p>
      </div>
      <AdminDataTable columns={columns} rows={rows} rowKey={(r) => r.id} emptyMessage="No coaches yet." />
    </div>
  )
}
