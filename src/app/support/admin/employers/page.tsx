import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { listAllAuthUsers, getAuthEmail } from '@/lib/admin/auth-users'
import { AdminDataTable, type AdminColumn } from '@/components/admin/AdminDataTable'

export const maxDuration = 30

interface Row {
  id: string
  name: string
  email: string
  companyName: string
  subscriptionTier: string
  rolesPosted: number
  createdAt: Date
}

export default async function AdminEmployersPage() {
  await requireAdmin()

  const [employers, authUsers] = await Promise.all([
    prisma.employerProfile.findMany({
      where: { isSampleData: false },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        contactName: true,
        companyName: true,
        subscriptionTier: true,
        createdAt: true,
        _count: { select: { roleProfiles: true } },
      },
    }),
    listAllAuthUsers(),
  ])

  const rows: Row[] = employers.map((e) => ({
    id: e.id,
    name: e.contactName ?? '—',
    email: getAuthEmail(authUsers, e.userId),
    companyName: e.companyName,
    subscriptionTier: e.subscriptionTier,
    rolesPosted: e._count.roleProfiles,
    createdAt: e.createdAt,
  }))

  const columns: AdminColumn<Row>[] = [
    {
      header: 'Contact',
      render: (r) => (
        <Link href={`/support/admin/employers/${r.id}`} className="text-primary underline underline-offset-4">
          {r.name}
        </Link>
      ),
    },
    { header: 'Company', render: (r) => r.companyName },
    { header: 'Email', render: (r) => r.email },
    { header: 'Tier', render: (r) => r.subscriptionTier },
    { header: 'Roles posted', render: (r) => r.rolesPosted },
    { header: 'Joined', className: 'px-3 py-2 font-medium tabular-nums', render: (r) => r.createdAt.toLocaleDateString() },
  ]

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hiring Managers</h1>
        <p className="mt-1 text-muted-foreground">{rows.length} employer accounts.</p>
      </div>
      <AdminDataTable columns={columns} rows={rows} rowKey={(r) => r.id} emptyMessage="No hiring managers yet." />
    </div>
  )
}
