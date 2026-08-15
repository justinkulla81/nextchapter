import { requireOutplacementRole } from '@/lib/employer/outplacement-auth'
import { getEnrollableContracts } from '@/lib/employer/outplacement-enrollment'
import { EnrollForms } from '@/components/employer/EnrollForms'

export default async function EmployerEnrollPage() {
  const orgUser = await requireOutplacementRole(['ADMIN'])
  const contracts = await getEnrollableContracts(orgUser.orgId)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Enroll</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add someone to an outplacement contract — one at a time or by CSV upload. NextChapter API
          enrollment isn&apos;t built yet; talk to your NextChapter contact if you need it.
        </p>
      </div>
      <EnrollForms contracts={contracts} />
    </div>
  )
}
