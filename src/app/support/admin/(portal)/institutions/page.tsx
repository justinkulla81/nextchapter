import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { readBranding } from '@/lib/institution/branding'
import { CreateCollegeForm, BrandingForm, InviteStaffForm } from '@/components/admin/InstitutionForms'
import { SubmitButton } from '@/components/ui/submit-button'
import { loadDemoContent } from './actions'

export const maxDuration = 30

export default async function InstitutionsAdminPage() {
  await requireAdmin()
  const colleges = await prisma.institution.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, slug: true, name: true, programBrandName: true, accentColor: true, logoUrl: true, profile: true,
      isDemo: true, isSampleData: true,
      users: { where: { revokedAt: null }, select: { invitedEmail: true, role: true, acceptedAt: true } },
      _count: { select: { targetCompanies: true, scopedJobPostings: true } },
    },
  })

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Colleges</h1>
        <p className="text-muted-foreground">
          Set up a college workspace, brand it with their logo, colour and imagery, and invite their staff. A demo
          works exactly like the real portal, flagged so it is never mistaken for a customer. Staff sign in at{' '}
          <a href="https://launchyournextchapter.com/institution/login" className="underline underline-offset-4">
            https://launchyournextchapter.com/institution/login
          </a>
          .
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
                    {c.slug} · {c._count.targetCompanies} target companies · {c._count.scopedJobPostings} alumni jobs
                  </p>
                </div>
                {b.accentColor && <span className="size-5 rounded-full border border-border" style={{ backgroundColor: b.accentColor }} />}
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium">Staff</p>
                {c.users.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No one invited yet.</p>
                ) : (
                  <ul className="text-sm text-muted-foreground">
                    {c.users.map((u) => (
                      <li key={`${u.invitedEmail}-${u.role}`}>
                        {u.invitedEmail} · {u.role.toLowerCase().replace(/_/g, ' ')} · {u.acceptedAt ? 'joined' : 'invited'}
                      </li>
                    ))}
                  </ul>
                )}
                <InviteStaffForm institutionId={c.id} />
              </div>

              <details className="space-y-2">
                <summary className="cursor-pointer text-sm font-medium">Branding</summary>
                <BrandingForm
                  institutionId={c.id}
                  defaults={{ programBrandName: c.programBrandName, accentColor: b.accentColor, tagline: b.tagline }}
                />
              </details>

              {c.isDemo && (
                <form action={loadDemoContent.bind(null, c.id)}>
                  <SubmitButton size="sm" variant="outline" pendingLabel="Loading…">
                    Load sample content
                  </SubmitButton>
                </form>
              )}
            </div>
          )
        })}
      </section>
    </div>
  )
}
