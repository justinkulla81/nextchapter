import { requireOutplacementRole } from '@/lib/employer/outplacement-auth'
import { getOrgRoster } from '@/lib/employer/outplacement-roster'
import { RosterTable } from '@/components/employer/RosterTable'

export default async function EmployerRosterPage() {
  const orgUser = await requireOutplacementRole(['ADMIN'])
  const seats = await getOrgRoster(orgUser)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Roster</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everyone you&apos;ve enrolled, across every contract. This is your own enrollment record — no
          activity, grade, or engagement detail is ever shown here or anywhere else on this portal.
        </p>
      </div>
      <RosterTable seats={seats} />
    </div>
  )
}
