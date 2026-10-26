import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/auth'
import { getOrganization, ownedTypes } from '@/lib/organizations/service'
import { INTEGRATIONS, integrationApplies, portalMeta, resolveIntegrations, type PortalType } from '@/lib/organizations/portals'
import { DeleteDemoButton, DemoControls, IntegrationToggles, OrganizationBrandForm } from '@/components/admin/OrganizationControls'
import { demoTargets } from '@/lib/demo/access'
import { prisma } from '@/lib/prisma'
import { frontDoorUrl } from '@/lib/organizations/front-door'
import { organizationOverview } from '@/lib/organizations/overview'
import { describeAuditAction } from '@/lib/partners/audit-labels'
import { EmployerSectionPlans } from '@/components/admin/EmployerSectionPlans'
import { EmployerWorkspaceControls } from '@/components/admin/EmployerWorkspaceControls'
import { loadStaffSectionViews } from '@/lib/employer/staff-workspaces'
import { WORKSPACE_PLANS } from '@/lib/employer/plans'
import { EMPLOYER_SECTIONS, sectionForWorkspaceType } from '@/lib/employer/sections'

export const metadata = { title: 'Organization' }

// Resetting rebuilds the whole demo, which can take a while.
export const maxDuration = 300

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://launchyournextchapter.com'

export default async function OrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const org = await getOrganization(id)
  if (!org) notFound()
  const owned = ownedTypes(org)
  const on = resolveIntegrations(org.features, owned)
  // Sections that are not linked to a portal record yet keep their audit entries under the workspace's own id.
  const refs = org.workspaces.flatMap((w) => [
    ...(w.refId ? [{ portal: w.type, refId: w.refId }] : []),
    ...(sectionForWorkspaceType(w.type) ? [{ portal: w.type, refId: w.id }] : []),
  ])
  const staffViews = await loadStaffSectionViews(org.id)
  const overview = await organizationOverview(org.workspaces)
  const sectionRows = EMPLOYER_SECTIONS.flatMap((sec) => {
    const w = org.workspaces.find((x) => sectionForWorkspaceType(x.type)?.key === sec.key)
    return w
      ? [{ workspaceId: w.id, label: sec.label, employees: sec.employees, status: w.status, plan: w.plan, planNote: w.planNote, planUpdatedAt: w.planUpdatedAt ? w.planUpdatedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null }]
      : []
  })
  const activity = refs.length
    ? await prisma.partnerAuditEvent.findMany({ where: { OR: refs }, orderBy: { createdAt: 'desc' }, take: 15 })
    : []

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div className="space-y-1">
        <Link href="/support/admin/organizations" className="text-sm text-muted-foreground underline underline-offset-4">
          All organizations
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {org.name}{' '}
          {org.isDemo ? <span className="ml-1 rounded-full bg-warn/20 px-2 py-0.5 align-middle text-xs font-medium">Demo</span> : <span className="ml-1 rounded-full bg-success/15 px-2 py-0.5 align-middle text-xs font-medium text-success">Live</span>}
        </h1>
        <p className="text-sm text-muted-foreground">
          Front door <a href={frontDoorUrl(org.slug)} className="underline underline-offset-4">{frontDoorUrl(org.slug)}</a>
          {org.domain ? <> · {org.domain}</> : null}
          {org.crmOrganizationId ? <> · <Link href={`/support/admin/crm/organizations/${org.crmOrganizationId}`} className="underline underline-offset-4">CRM record</Link></> : null}
          {org.isDemo && org.demoExpiresAt ? <> · expires {org.demoExpiresAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</> : null}
        </p>
      </div>

      <section className="space-y-3" aria-labelledby="ws">
        <h2 id="ws" className="text-lg font-semibold">Portals</h2>
        <ul className="space-y-2">
          {org.workspaces.map((w) => {
            const m = portalMeta(w.type as PortalType)
            return (
              <li key={w.id} className="rounded-md border border-border p-3 text-sm">
                <p className="font-medium">
                  {m.label} <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs font-normal">{w.status.toLowerCase()}</span>
                </p>
                <p className="text-muted-foreground">Sign in at <code className="text-xs">{appUrl}{m.signInPath}</code>{m.type === 'HIGHER_ED' ? <> · portal <Link href={`/i/${org.slug}`} className="underline underline-offset-4">/i/{org.slug}</Link></> : null}</p>
                {w.status === 'PENDING' && w.inviteToken && (
                  <p className="mt-1 break-all text-muted-foreground">Waiting for {w.inviteEmail} to sign up at <code className="text-xs">{appUrl}/talent/signup</code>. It goes live when they do.</p>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      {(sectionRows.length > 0 || org.enterprise) && (
        <section className="space-y-3" aria-labelledby="sections">
          <h2 id="sections" className="text-lg font-semibold">Employer sections and plans</h2>
          <p className="text-sm text-muted-foreground">Hiring, Employees and Outplacement are claimed and paid for separately, or together as the enterprise package. This records the plan only; no payment is taken here.</p>
          <EmployerSectionPlans
            organizationId={org.id}
            enterprise={org.enterprise}
            enterpriseSince={org.enterpriseSince ? org.enterpriseSince.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null}
            rows={sectionRows}
            plans={WORKSPACE_PLANS}
          />
          <h3 className="pt-4 text-base font-semibold">Section access</h3>
          <p className="text-sm text-muted-foreground">A verified claim creates a pending section. Activate it, link its employer record and choose who is on its team here. Nothing is granted automatically, and no contract or seat is created.</p>
          <EmployerWorkspaceControls views={staffViews.views} loadError={staffViews.error ?? null} />
        </section>
      )}

      {overview.length > 0 && (
        <section className="space-y-3" aria-labelledby="glance">
          <h2 id="glance" className="text-lg font-semibold">At a glance</h2>
          <p className="text-sm text-muted-foreground">Counts across every portal this organization owns{org.isDemo ? ', including the sample data' : ''}.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {overview.map((o) => (
              <div key={o.type} className="rounded-md border border-border p-3">
                <p className="text-sm font-medium">{portalMeta(o.type as PortalType).label}</p>
                <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  {o.stats.map((st) => (
                    <div key={st.label}>
                      <dt className="text-muted-foreground">{st.label}</dt>
                      <dd className="text-lg font-semibold tabular-nums">{st.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3" aria-labelledby="recent">
        <h2 id="recent" className="text-lg font-semibold">Recent activity across portals</h2>
        {activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing yet. Downloads, brand changes and demo sign-ins appear here as they happen.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {activity.map((e) => (
              <li key={e.id} className="flex flex-wrap gap-x-2">
                <span className="text-muted-foreground">{e.createdAt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                <span>{portalMeta(e.portal as PortalType).label}:</span>
                <span>{describeAuditAction(e.action)}</span>
                {e.actorLabel ? <span className="text-muted-foreground">by {e.actorLabel}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="brand">
        <h2 id="brand" className="text-lg font-semibold">Brand</h2>
        <p className="text-sm text-muted-foreground">One logo, name and color for every portal this organization owns. It replaces the brand each portal stored for itself.</p>
        <OrganizationBrandForm organizationId={org.id} brandName={org.brandName} accent={org.accentColor} secondary={org.secondaryColor} background={org.backgroundColor} logoUrl={org.logoUrl} />
      </section>

      <section className="space-y-3" aria-labelledby="conn">
        <h2 id="conn" className="text-lg font-semibold">Connections between portals</h2>
        <p className="text-sm text-muted-foreground">On by default when the organization owns both sides. Turn one off to keep those portals separate.</p>
        <IntegrationToggles organizationId={org.id} items={INTEGRATIONS.map((i) => ({ key: i.key, label: i.label, does: i.does, applies: integrationApplies(i, owned), on: on[i.key] }))} />
      </section>

      {org.isDemo && (
        <section className="space-y-2 rounded-md border border-border p-4" aria-labelledby="demo">
          <h2 id="demo" className="text-lg font-semibold">Demo</h2>
          <p className="text-sm text-muted-foreground">Sample data only, kept out of real numbers, no real email sent. {org.demoScenario ? `${org.demoScenario} amount of data.` : ''}</p>
          <DemoControls
            organizationId={org.id}
            targets={demoTargets(org, org.workspaces).map((t) => ({ key: t.key, label: t.label, needsLink: t.email !== null }))}
            expires={org.demoExpiresAt ? org.demoExpiresAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null}
          />
          <DeleteDemoButton organizationId={org.id} name={org.name} />
        </section>
      )}
    </div>
  )
}
