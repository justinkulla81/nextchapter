import { requireOutplacementRole } from '@/lib/employer/outplacement-auth'
import { getOrgRoster, summarizeCohorts } from '@/lib/employer/outplacement-roster'
import { RosterTable } from '@/components/employer/RosterTable'
import { CohortsPanel } from '@/components/employer/CohortsPanel'
import { orgProgram } from '@/lib/employer/program-server'

export default async function EmployerRosterPage({ searchParams }: { searchParams: Promise<{ cohort?: string }> }) {
  const orgUser = await requireOutplacementRole(['ADMIN'])
  const { cohort } = await searchParams
  const [seats, program] = await Promise.all([getOrgRoster(orgUser), orgProgram(orgUser.orgId)])
  const packages = [{ key: 'all', name: 'Everyone (all services)' }, ...program.settings.packages.map((p) => ({ key: p.key, name: p.name }))]
  const cohorts = summarizeCohorts(seats)
  const shown = cohort === undefined ? seats : seats.filter((s) => (s.cohort ?? '') === cohort)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Roster</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everyone you&apos;ve enrolled, across every contract. This is your own enrollment record — no
          activity, grade, or engagement detail is ever shown here or anywhere else on this portal.
        </p>
      </div>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Cohorts</h2>
        <CohortsPanel cohorts={cohorts} packages={packages} current={cohort ?? null} />
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{cohort === undefined ? 'Everyone' : cohort ? cohort : 'No cohort'}</h2>
        <RosterTable seats={shown} packages={packages} />
      </section>
    </div>
  )
}
