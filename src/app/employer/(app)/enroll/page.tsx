import { requireOutplacementRole } from '@/lib/employer/outplacement-auth'
import { getEnrollableContracts } from '@/lib/employer/outplacement-enrollment'
import { EnrollForms } from '@/components/employer/EnrollForms'
import { enrollIntro, programKindOf } from '@/lib/employer/program-wording'
import { orgProgram } from '@/lib/employer/program-server'

export default async function EmployerEnrollPage() {
  const orgUser = await requireOutplacementRole(['ADMIN'])
  const [contracts, program] = await Promise.all([getEnrollableContracts(orgUser.orgId), orgProgram(orgUser.orgId)])
  const packages = [{ key: 'all', name: 'Everyone (all services)' }, ...program.settings.packages.map((p) => ({ key: p.key, name: p.name }))]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Enroll</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {enrollIntro([...new Set(contracts.map((c) => programKindOf(c.journey)))])}
        </p>
      </div>
      <EnrollForms contracts={contracts} packages={packages} />
    </div>
  )
}
