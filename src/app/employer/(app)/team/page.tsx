import { requireOutplacementRole } from '@/lib/employer/outplacement-auth'
import { listOrgUsers } from '@/lib/employer/outplacement-org-users'
import { InviteOrgUserForm } from '@/components/employer/InviteOrgUserForm'

const ROLE_LABEL: Record<string, string> = { ADMIN: 'Admin', VIEWER: 'Viewer', LEGAL: 'Legal', FINANCE: 'Finance' }

function fmt(d: Date | null) {
  return d ? new Date(d).toLocaleDateString() : '—'
}

export default async function EmployerTeamPage() {
  const orgUser = await requireOutplacementRole(['ADMIN'])
  const users = await listOrgUsers(orgUser)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Who has access to this account, and what they can see — admin, viewer, legal, or finance.
        </p>
      </div>

      <InviteOrgUserForm />

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left">
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Invited</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-3 py-2">{u.fullName ?? '—'}</td>
                <td className="px-3 py-2">{u.invitedEmail}</td>
                <td className="px-3 py-2">{ROLE_LABEL[u.role]}</td>
                <td className="px-3 py-2">{u.acceptedAt ? 'Active' : 'Invited'}</td>
                <td className="px-3 py-2 tabular-nums">{fmt(u.invitedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
