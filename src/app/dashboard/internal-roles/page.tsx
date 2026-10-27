import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { listInternalRoles, staffProgramsForCandidate } from '@/lib/employer/staff-programs'
import { captureServerEvent } from '@/lib/posthog/server'
import { InterestButton } from '@/components/dashboard/staff/StaffButtons'

import { PageHeader } from '@/components/candidate/PageHeader'
import { ActionLink } from '@/components/candidate/ActionLink'

export const metadata: Metadata = { title: 'Roles at your company' }

// Open roles an employer posted for its own people on a Growth seat. Never
// on the public board.
export default async function InternalRolesPage() {
  const profile = await getDashboardProfile()
  const programs = (await staffProgramsForCandidate(profile.id)).filter((p) => p.programType === 'GROWTH')
  if (!programs.length) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Roles at your company"
          intro="When your employer offers career growth through NextChapter, the roles they post for their own people show up here."
          action={
            <ActionLink href="/dashboard/find-my-job" kind="primary" event="internal_roles_find_job_clicked" props={{ source: 'internal_roles_empty' }}>
              Find a job
            </ActionLink>
          }
        />
        <p className="max-w-2xl text-base text-muted-foreground">Nothing to show yet. For every open job outside your company, use Find a job.</p>
      </div>
    )
  }
  const lists = await Promise.all(programs.map(async (p) => ({ ...p, roles: await listInternalRoles(p.orgId, { openOnly: true }) })))
  const mine = new Set(
    (await prisma.internalRoleInterest.findMany({ where: { candidateId: profile.id, postingId: { in: lists.flatMap((l) => l.roles.map((r) => r.id)) } }, select: { postingId: true } })).map((r) => r.postingId)
  )
  captureServerEvent(profile.id, 'internal_roles_viewed', { orgs: programs.length, roles: lists.reduce((n, l) => n + l.roles.length, 0) })

  const roleCount = lists.reduce((n, l) => n + l.roles.length, 0)
  return (
    <div className="space-y-8">
      <PageHeader
        title="Roles at your company"
        intro="Only people at your company see these. Looking is private: your employer learns your name only if you press “I’m interested” on a role."
        action={
          roleCount === 0 ? (
            <ActionLink href="/dashboard/in-work?tab=promotion" kind="primary" event="internal_roles_promotion_plan_clicked" props={{ source: 'internal_roles_empty' }}>
              Build your promotion plan
            </ActionLink>
          ) : undefined
        }
      />
      {lists.map((l) => (
        <section key={l.orgId} aria-labelledby={`roles-${l.orgId}`} className="space-y-3">
          {lists.length > 1 && (
            <h2 id={`roles-${l.orgId}`} className="font-display text-xl font-semibold text-ink">
              {l.orgName}
            </h2>
          )}
          {l.roles.length === 0 ? (
            <p className="text-base text-muted-foreground">{l.orgName} has no internal roles posted right now. Check back, or work on your promotion plan in the meantime.</p>
          ) : (
            <ul className="divide-y divide-border rounded-2xl border border-border">
              {l.roles.map((r) => (
                <li key={r.id} className="space-y-3 p-4">
                  <div>
                    <h3 className="text-base font-semibold text-ink">{r.title}</h3>
                    <p className="text-sm text-muted-foreground">Posted by {l.orgName} for its own people{r.location ? ` · ${r.location}` : ''}</p>
                  </div>
                  {r.description && (
                    <details className="text-sm">
                      <summary className="cursor-pointer font-medium text-brand">About the role</summary>
                      <p className="mt-2 whitespace-pre-line text-ink">{r.description}</p>
                    </details>
                  )}
                  <div className="flex flex-wrap items-start gap-4">
                    <InterestButton postingId={r.id} orgName={l.orgName} interested={mine.has(r.id)} />
                    {r.applyUrl && (
                      <ActionLink href={r.applyUrl} external kind="text" className="pt-1.5" event="internal_role_apply_opened" props={{ postingId: r.id, orgId: l.orgId }}>
                        Apply in {l.orgName}’s system
                      </ActionLink>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      {roleCount > 0 && (
        <p className="text-sm text-muted-foreground">
          Getting ready for a move up?{' '}
          <Link href="/dashboard/in-work?tab=promotion" className="font-medium text-brand underline underline-offset-4">
            Build your promotion plan
          </Link>
          .
        </p>
      )}
    </div>
  )
}
