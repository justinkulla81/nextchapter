import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { readBranding } from '@/lib/institution/branding'
import { CreateCollegeForm, BrandingForm, InviteStaffForm, LicenseForm, RegionForm } from '@/components/admin/InstitutionForms'
import { readProfile, regionAreas } from '@/lib/higher-ed/profile'
import { ConfirmActionButton } from '@/components/higher-ed/ConfirmActionButton'
import { ActionButton } from '@/components/higher-ed/CommunityForms'
import { STAFF_ROLE_LABELS, TIER_LABELS, getWorkspace } from '@/lib/higher-ed/workspaces'
import { SubmitButton } from '@/components/ui/submit-button'
import { loadDemoContent, removeCollegeStaff, resendCollegeStaffInvite, resetDemoFixture } from './actions'
import { DEMO_TENANTS } from '@/lib/higher-ed/demo-tenants'
import { SERVICES, serviceSettingsFrom } from '@/lib/higher-ed/services'

// The college portal lives on the main site (its session cookie), not on the
// admin subdomain.
const PORTAL_ORIGIN = process.env.NEXT_PUBLIC_APP_URL || 'https://launchyournextchapter.com'

export const maxDuration = 30

export default async function InstitutionsAdminPage() {
  await requireAdmin()
  const colleges = await prisma.institution.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, slug: true, name: true, programBrandName: true, accentColor: true, logoUrl: true, profile: true,
      isDemo: true, isSampleData: true, crmOrganizationId: true, tier: true, includedSeats: true, enabledFeatures: true, alumniCount: true, licenseStartAt: true, licenseEndAt: true,
      users: { where: { revokedAt: null }, select: { id: true, invitedEmail: true, fullName: true, role: true, workspace: true, acceptedAt: true } },
      _count: { select: { targetCompanies: true, scopedJobPostings: true, members: true } },
    },
  })

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Higher ed</h1>
        <p className="text-muted-foreground">
          Set up a college workspace, brand it with their logo, colour and imagery, and invite their staff. A demo
          works exactly like the real portal, flagged so it is never mistaken for a customer. Each college&apos;s portal is at{' '}
          <span className="font-mono text-xs">{PORTAL_ORIGIN}/i/&lt;slug&gt;</span>; invited staff sign in with the normal
          NextChapter login and land there. NextChapter admins see every workspace on a demo college.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">New college</h2>
        <CreateCollegeForm />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{colleges.length} {colleges.length === 1 ? 'college' : 'colleges'}</h2>
        {colleges.map((c) => {
          const b = readBranding(c)
          return (
            <div key={c.id} className="space-y-4 rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center gap-3">
                {b.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.logoUrl} alt="" className="h-10 w-auto rounded-sm object-contain" />
                )}
                <div>
                  <p className="font-medium text-foreground">
                    {c.name}{' '}
                    {c.isDemo && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">Demo</span>}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <a href={`${PORTAL_ORIGIN}/i/${c.slug}`} target="_blank" rel="noreferrer" className="font-medium text-foreground underline underline-offset-4">
                      Open portal
                    </a>{' '}
                    · {c.slug} · {TIER_LABELS[c.tier]} tier · {c._count.members.toLocaleString()} members · {c.includedSeats.toLocaleString()} seats ·{' '}
                    {SERVICES.filter((sv) => serviceSettingsFrom(c.enabledFeatures)[sv.key].on).length} services on ·{' '}
                    {c.crmOrganizationId ? (
                      <a href={`/support/admin/crm/organizations/${c.crmOrganizationId}`} className="underline underline-offset-4">
                        CRM record
                      </a>
                    ) : (
                      'no CRM record'
                    )}{' '}
                    · {c._count.targetCompanies} target companies · {c._count.scopedJobPostings} alumni jobs
                  </p>
                </div>
                {b.accentColor && <span className="size-5 rounded-full border border-border" style={{ backgroundColor: b.accentColor }} />}
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium">Staff</p>
                {c.users.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No one invited yet.</p>
                ) : (
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {c.users.map((u) => (
                      <li key={u.id} className="flex flex-wrap items-center gap-2">
                        <span>
                          {u.fullName ? `${u.fullName} · ` : ''}
                          {u.invitedEmail} · {STAFF_ROLE_LABELS[u.role]}
                          {u.workspace ? ` (${getWorkspace(u.workspace)?.label ?? u.workspace}, read-only)` : ''} · {u.acceptedAt ? 'joined' : 'invited'}
                        </span>
                        {!u.acceptedAt && <ActionButton label="Resend" done="Sent." run={resendCollegeStaffInvite.bind(null, u.id)} />}
                        <ConfirmActionButton variant="outline" label="Remove" confirm={`Remove ${u.invitedEmail} as ${STAFF_ROLE_LABELS[u.role]}?`} confirmLabel="Remove" run={removeCollegeStaff.bind(null, u.id)} />
                      </li>
                    ))}
                  </ul>
                )}
                <InviteStaffForm institutionId={c.id} />
              </div>

              <details className="space-y-2" open={c.tier === 'CAREER' && !c.isDemo && c.includedSeats === 0}>
                <summary className="cursor-pointer text-sm font-medium">License: {TIER_LABELS[c.tier]}, {c.includedSeats.toLocaleString()} seats{c.licenseEndAt ? `, through ${c.licenseEndAt.toISOString().slice(0, 10)}` : ''}</summary>
                <LicenseForm
                  institutionId={c.id}
                  defaults={{ tier: c.tier, includedSeats: c.includedSeats, alumniCount: c.alumniCount, licenseStartAt: c.licenseStartAt?.toISOString().slice(0, 10) ?? '', licenseEndAt: c.licenseEndAt?.toISOString().slice(0, 10) ?? '' }}
                />
              </details>

              <details className="space-y-2">
                <summary className="cursor-pointer text-sm font-medium">
                  Local market:{' '}
                  {(() => {
                    const r = readProfile(c.profile).region
                    const a = regionAreas(r)
                    return a.length ? `${r?.name} (${a.map((x) => `${x.state}: ${x.counties.length}`).join(', ')} counties)` : 'not set'
                  })()}
                </summary>
                <RegionForm institutionId={c.id} defaults={{ name: readProfile(c.profile).region?.name ?? '', areas: regionAreas(readProfile(c.profile).region) }} />
              </details>

              <details className="space-y-2">
                <summary className="cursor-pointer text-sm font-medium">Branding</summary>
                <BrandingForm
                  institutionId={c.id}
                  defaults={{ programBrandName: c.programBrandName, accentColor: b.accentColor, tagline: b.tagline }}
                />
              </details>

              {c.isDemo && (
                <div className="flex flex-wrap items-center gap-3">
                  <form action={loadDemoContent.bind(null, c.id)}>
                    <SubmitButton size="sm" variant="outline" pendingLabel="Loading…">
                      Load sample content
                    </SubmitButton>
                  </form>
                  {DEMO_TENANTS[c.slug] && (
                    <form action={resetDemoFixture.bind(null, c.id)}>
                      <SubmitButton size="sm" variant="outline" pendingLabel="Resetting…" savedLabel="Reset">
                        Reset to fixture
                      </SubmitButton>
                    </form>
                  )}
                  {DEMO_TENANTS[c.slug] && (
                    <p className="text-xs text-muted-foreground">
                      Reset replaces this demo&apos;s fictional members, staff, flags and gifts with its fixture, then reloads sample content.
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </section>
    </div>
  )
}
