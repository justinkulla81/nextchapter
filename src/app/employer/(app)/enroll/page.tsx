import { requireOutplacementRole } from '@/lib/employer/outplacement-auth'
import { getEnrollableContracts } from '@/lib/employer/outplacement-enrollment'
import { EnrollForms } from '@/components/employer/EnrollForms'
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
          Add someone to an outplacement contract, one at a time or by CSV upload. They get an email with your welcome and the services in their package.
        </p>
      </div>
      <EnrollForms contracts={contracts} packages={packages} />
    </div>
  )
}
