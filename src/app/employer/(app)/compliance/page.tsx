import { requireOutplacementRole } from '@/lib/employer/outplacement-auth'
import { CompliancePackLookup } from '@/components/employer/CompliancePackLookup'

export default async function EmployerCompliancePage() {
  // employer_legal only — see outplacement-compliance.ts's own comment for
  // why there is deliberately no employer_admin fallback here.
  await requireOutplacementRole(['LEGAL'])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Compliance pack</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Look up a specific person&apos;s enrollment record to confirm their outplacement benefit was
          delivered — for compliance and separation-agreement purposes. This is the only place on this
          portal where an individual&apos;s record is shown; it contains no job-search activity, grade, or
          engagement detail.
        </p>
      </div>
      <CompliancePackLookup />
    </div>
  )
}
