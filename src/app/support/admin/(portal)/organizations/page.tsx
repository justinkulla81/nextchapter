import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { listOrganizations } from '@/lib/organizations/service'
import { portalMeta, type PortalType } from '@/lib/organizations/portals'

export const metadata = { title: 'Organizations' }

const when = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export default async function OrganizationsPage() {
  await requireAdmin()
  const orgs = await listOrganizations()
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Organizations</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Every customer in one place. An organization owns one or many portals (higher ed, outplacement, coach, hiring, recruiter), one brand, and can be a demo with sample data.
          </p>
        </div>
        <Link href="/support/admin/organizations/new" className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
          New organization
        </Link>
      </div>
      {orgs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">No organizations yet. Create one, or start from a won deal in the CRM.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-2">Organization</th>
                <th className="px-4 py-2">Portals</th>
                <th className="px-4 py-2">Mode</th>
                <th className="px-4 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((o) => (
                <tr key={o.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <Link href={`/support/admin/organizations/${o.id}`} className="font-medium text-primary underline underline-offset-4">
                      {o.name}
                    </Link>
                    <span className="block text-xs text-muted-foreground">/p/{o.slug}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex flex-wrap gap-1">
                      {o.workspaces.map((w) => (
                        <span key={w.id} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                          {portalMeta(w.type as PortalType).label}
                          {w.status !== 'ACTIVE' ? ` (${w.status.toLowerCase()})` : ''}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {o.isDemo ? (
                      <span className="rounded-full bg-warn/20 px-2 py-0.5 text-xs font-medium">Demo{o.demoExpiresAt ? `, expires ${when(o.demoExpiresAt)}` : ''}</span>
                    ) : (
                      <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">Live</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{when(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
