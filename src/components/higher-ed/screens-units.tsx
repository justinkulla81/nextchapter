// Admin › Schools and departments (owner decision 2026-11-18): a university can have the whole institution, one school or
// department, or several, each its own account with its own plan and administrator. Its staff see only the alumni whose
// roster school (and department, when set) match. Whole-institution administrators only.

import { Building2 } from 'lucide-react'
import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { prisma } from '@/lib/prisma'
import { unitMemberWhere } from '@/lib/plans/visible-members'
import { EmptyState } from '@/components/ui/empty-state'
import { AddUnitForm, UnitAdminInvite } from './UnitForms'

export async function AdminUnits({ ctx }: { ctx: WorkspaceContext }) {
  const id = ctx.institution.id
  const canEdit = !ctx.readOnly && !ctx.institution.isDemo && ctx.tokens.has('INSTITUTION_ADMIN')
  const [units, schools] = await Promise.all([
    prisma.institutionUnit.findMany({
      where: { institutionId: id },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, school: true, department: true, plan: true, staff: { where: { revokedAt: null }, select: { role: true, invitedEmail: true, acceptedAt: true } } },
    }),
    // The roster's school names, to suggest (a few dozen at most).
    prisma.institutionMember.groupBy({ by: ['school'], where: { institutionId: id, school: { not: null } }, _count: { _all: true }, orderBy: { _count: { school: 'desc' } }, take: 50 }),
  ])
  const counts = await Promise.all(units.map((u) => prisma.institutionMember.count({ where: { institutionId: id, ...unitMemberWhere([u]) } })))
  return (
    <div className="space-y-8">
      <p className="max-w-3xl text-sm text-muted-foreground">
        A school or department can have its own account: its own administrator and team, its own plan, and only its own alumni (matched on the school and
        department columns of your roster). Your whole-institution staff still see everyone. Each one starts on the free plan; ask NextChapter to switch one to
        paid at support@launchyournextchapter.com.
      </p>

      {canEdit && <AddUnitForm slug={ctx.institution.slug} schools={schools.map((s) => s.school!).filter(Boolean)} />}

      {units.length === 0 ? (
        <EmptyState icon={Building2} title="No schools or departments yet" description="Add one above when a school wants its own account." />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {units.map((u, i) => {
            const admins = u.staff.filter((s) => s.role === 'INSTITUTION_ADMIN')
            return (
              <li key={u.id} className="space-y-2 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">{u.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {u.plan === 'PAID' ? 'Paid plan' : 'Free plan'} · {counts[i].toLocaleString()} alumni on the roster · {u.staff.length} staff
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {admins.length
                    ? `Administrator: ${admins.map((a) => `${a.invitedEmail}${a.acceptedAt ? '' : ' (invited)'}`).join(', ')}`
                    : 'No administrator yet.'}
                </p>
                {canEdit && (u.plan === 'PAID' || admins.length === 0) && <UnitAdminInvite slug={ctx.institution.slug} unitId={u.id} unitName={u.name} />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
