import { getCurrentInstitutionUser } from '@/lib/institution/auth'
import { can } from '@/lib/institution/permissions'
import { listTargetCompanies } from '@/lib/companies/institution-targets'
import { TargetCompanyForm } from '@/components/institution/TargetCompanyForm'
import { SubmitButton } from '@/components/ui/submit-button'
import { removeTargetCompany } from './actions'

export default async function InstitutionCompaniesPage() {
  const user = await getCurrentInstitutionUser()
  const targets = await listTargetCompanies(user.institutionId)
  const canManage = can(user.role, 'manage_target_companies')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Target companies</h1>
        <p className="text-muted-foreground">
          Employers you want to place alumni with or build a relationship with. Only your team sees this list.
        </p>
      </div>
      {canManage && <TargetCompanyForm />}
      <div className="divide-y divide-border rounded-lg border border-border">
        {targets.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">No target companies yet.</p>
        ) : (
          targets.map((t) => (
            <div key={t.companyId} className="flex items-center justify-between gap-4 px-4 py-3">
              <div>
                <p className="font-medium text-foreground">{t.name}</p>
                <p className="text-sm text-muted-foreground">{[t.industry, t.note].filter(Boolean).join(' · ')}</p>
              </div>
              {canManage && (
                <form action={removeTargetCompany.bind(null, t.companyId)}>
                  <SubmitButton size="sm" variant="outline" pendingLabel="Removing…">
                    Remove
                  </SubmitButton>
                </form>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
