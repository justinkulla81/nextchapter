import type { Metadata } from 'next'
import Link from 'next/link'
import { requireEmployeesRole } from '@/lib/employer/outplacement-auth'
import { growthReport, listInternalRoles, orgProgramTypes } from '@/lib/employer/staff-programs'
import { PROGRAM_TYPE_BLURB } from '@/lib/employer/program-type'
import { NotOnProgram, StatTile, showCell } from '@/components/employer/StaffStats'
import { AddInternalRoleForm, InternalRoleOpenToggle } from '@/components/employer/StaffProgramForms'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Retention' }

export default async function EmployerGrowthPage() {
  const orgUser = await requireEmployeesRole(['ADMIN', 'VIEWER'])
  if (!(await orgProgramTypes(orgUser.orgId)).has('GROWTH')) return <NotOnProgram program="Retention" what={PROGRAM_TYPE_BLURB.GROWTH} />
  const [r, roles] = await Promise.all([growthReport(orgUser.orgId), listInternalRoles(orgUser.orgId)])
  const isAdmin = orgUser.role === 'ADMIN'
  const o = r.overall

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Employees · Retention</p>
        <h1 className="text-2xl font-semibold tracking-tight">Keep and grow your people</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Counts only. Nobody’s individual activity is shown here, and each count waits until at least 10 people have joined. Promotions and raises count only
          people who chose to share them.
        </p>
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link href="/employer/enroll" className={cn(buttonVariants())}>
              Enroll people
            </Link>
            <a href="#internal-roles" className="text-sm text-muted-foreground underline underline-offset-4">
              Post an internal role
            </a>
          </div>
        )}
      </div>

      <section aria-labelledby="growth-participation" className="space-y-3">
        <h2 id="growth-participation" className="text-lg font-semibold">
          Participation
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatTile label="Joined" value={o.joined} of={r.enrolled} />
          <StatTile label="Active in the last 30 days" value={o.active30} />
          <StatTile label="Using review, wins and feedback tools" value={o.usingTools} />
          <StatTile label="Building a promotion plan" value={o.promotionPlans} />
          <StatTile label="Finished review prep this year" value={o.reviewPrepDone} />
          <StatTile label="Raised a hand for an internal role" value={o.interestedInInternal} />
        </div>
      </section>

      <section aria-labelledby="growth-outcomes" className="space-y-3">
        <h2 id="growth-outcomes" className="text-lg font-semibold">
          Outcomes, last 12 months
        </h2>
        <p className="text-sm text-muted-foreground">{r.outcomes.sharing} people share their review outcomes with you.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <StatTile label="Promoted" value={r.outcomes.promoted} of={r.outcomes.promoted === null ? undefined : r.outcomes.sharing} />
          <StatTile label="Got a raise" value={r.outcomes.raised} of={r.outcomes.raised === null ? undefined : r.outcomes.sharing} />
        </div>
      </section>

      {r.byTeam.length > 0 && (
        <section aria-labelledby="growth-teams" className="space-y-3">
          <h2 id="growth-teams" className="text-lg font-semibold">
            By team
          </h2>
          <p className="text-sm text-muted-foreground">Teams are the group you enrolled people with. Teams under 10 people are pooled.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-2 py-1 font-medium">Team</th>
                  <th className="px-2 py-1 font-medium">Joined</th>
                  <th className="px-2 py-1 font-medium">Active, 30 days</th>
                  <th className="px-2 py-1 font-medium">Promotion plans</th>
                  <th className="px-2 py-1 font-medium">Internal interest</th>
                </tr>
              </thead>
              <tbody>
                {r.byTeam.map((t) => (
                  <tr key={t.label} className="border-t border-border tabular-nums">
                    <td className="px-2 py-1">{t.label}</td>
                    <td className="px-2 py-1">{t.joined}</td>
                    <td className="px-2 py-1">{showCell(t.active30)}</td>
                    <td className="px-2 py-1">{showCell(t.promotionPlans)}</td>
                    <td className="px-2 py-1">{showCell(t.interestedInInternal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section id="internal-roles" aria-labelledby="growth-roles" className="space-y-4">
        <div>
          <h2 id="growth-roles" className="text-lg font-semibold">
            Internal roles
          </h2>
          <p className="text-sm text-muted-foreground">
            Only the employees you enrolled see these, never the public job board. When someone presses “I’m interested”, they’re choosing to share their name
            with you for that role.
          </p>
        </div>
        {roles.length === 0 ? (
          <p className="text-sm text-muted-foreground">No internal roles posted yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {roles.map((role) => (
              <li key={role.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-medium">
                    {role.title}
                    {role.archivedAt && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">Closed</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[role.location, `Posted ${role.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <Link href={`/employer/growth/roles/${role.id}`} className="text-sm font-medium underline underline-offset-4">
                    {role.interested} interested
                  </Link>
                  {isAdmin && <InternalRoleOpenToggle postingId={role.id} title={role.title} open={!role.archivedAt} />}
                </div>
              </li>
            ))}
          </ul>
        )}
        {isAdmin && (
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-3 text-base font-semibold">Post a role</h3>
            <AddInternalRoleForm />
          </div>
        )}
      </section>
    </div>
  )
}
