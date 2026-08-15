import { requireAdmin } from '@/lib/admin/auth'
import { listOutplacementOrgs } from '@/lib/admin/outplacement-contracts'
import { CreateOrgForm, CreateContractForm, InviteFirstAdminForm } from '@/components/admin/OutplacementContractForms'

const TIER_LABEL: Record<string, string> = { CORE: 'Core', PLUS: 'Plus', PREMIUM: 'Premium' }

function fmt(d: Date) {
  return new Date(d).toLocaleDateString()
}

export default async function AdminOutplacementContractsPage() {
  await requireAdmin()
  const orgs = await listOutplacementOrgs()

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Employer contracts</h1>
        <p className="mt-1 text-muted-foreground">
          Outplacement (§A7/§A9) — provisioning for the /employer portal. Create the buying organization,
          set up a contract (tier, seats, term), then invite that org&apos;s first employer_admin.
          Enrollment of individual employees happens from inside the employer portal itself, not here.
        </p>
      </div>

      <CreateOrgForm />
      <CreateContractForm orgs={orgs.map((o) => ({ id: o.id, name: o.name }))} />
      <InviteFirstAdminForm orgs={orgs.map((o) => ({ id: o.id, name: o.name }))} />

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Organizations</h2>
        {orgs.length === 0 && <p className="text-sm text-muted-foreground">No organizations yet.</p>}
        {orgs.map((org) => (
          <div key={org.id} className="rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">
                {org.name}
                {org.isSampleData && (
                  <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                    Sample
                  </span>
                )}
              </h3>
              <span className="text-sm text-muted-foreground">{org.primaryContactEmail}</span>
            </div>
            {org.contracts.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No contracts yet.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="px-2 py-1 font-medium">Cohort</th>
                      <th className="px-2 py-1 font-medium">Tier</th>
                      <th className="px-2 py-1 font-medium">Seats used</th>
                      <th className="px-2 py-1 font-medium">Term</th>
                      <th className="px-2 py-1 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {org.contracts.map((c) => (
                      <tr key={c.id} className="border-t border-border">
                        <td className="px-2 py-1">{c.cohortLabel ?? '—'}</td>
                        <td className="px-2 py-1">{TIER_LABEL[c.tier]}</td>
                        <td className="px-2 py-1 tabular-nums">
                          {c.usedSeats} / {c.seatCount}
                        </td>
                        <td className="px-2 py-1 whitespace-nowrap">
                          {fmt(c.termStartAt)} – {fmt(c.termEndAt)}
                        </td>
                        <td className="px-2 py-1">{c.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
