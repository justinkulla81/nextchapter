import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { ConfirmActionButton } from '@/components/higher-ed/ConfirmActionButton'
import { AddSystemUserForm, CampusPicker, CreateSystemForm } from '@/components/admin/SystemForms'
import { revokeSystemUser, setCampusSystem } from './actions'

const PORTAL_ORIGIN = process.env.NEXT_PUBLIC_APP_URL || 'https://launchyournextchapter.com'

// Multi-campus systems: group colleges under one license and give system
// leaders (by email) a read-only dashboard across campuses at /systems.
export default async function CollegeSystemsPage() {
  await requireAdmin()
  const [systems, free] = await Promise.all([
    prisma.institutionSystem.findMany({
      orderBy: { name: 'asc' },
      include: { campuses: { select: { id: true, name: true, slug: true }, orderBy: { name: 'asc' } }, users: { where: { revokedAt: null }, orderBy: { email: 'asc' } } },
    }),
    prisma.institution.findMany({ where: { systemId: null }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])
  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">College systems</h1>
        <p className="max-w-3xl text-muted-foreground">
          Group colleges that buy together (a state system, a multi-campus university). Each campus keeps its own portal and staff. People you add here sign in with
          the normal NextChapter login and open <span className="font-mono text-xs">{PORTAL_ORIGIN}/systems</span> for counts across campuses. They see no names.
        </p>
      </div>
      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <h2 className="text-lg font-semibold">New system</h2>
        <CreateSystemForm />
      </section>
      {systems.length ? (
        systems.map((s) => (
          <section key={s.id} className="space-y-4 rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold">{s.name}</h2>
              <Link className="text-sm text-primary underline" href={`${PORTAL_ORIGIN}/systems/${s.slug}`}>
                Open dashboard
              </Link>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Campuses ({s.campuses.length})</h3>
              <ul className="space-y-1 text-sm">
                {s.campuses.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>{c.name} <span className="font-mono text-xs text-muted-foreground">/i/{c.slug}</span></span>
                    <ConfirmActionButton variant="outline" label="Remove" confirm={`Take ${c.name} out of ${s.name}? Its portal is unchanged.`} confirmLabel="Remove campus" run={setCampusSystem.bind(null, c.id, null)} />
                  </li>
                ))}
              </ul>
              <CampusPicker systemId={s.id} options={free} />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">People who see the dashboard ({s.users.length})</h3>
              <ul className="space-y-1 text-sm">
                {s.users.map((u) => (
                  <li key={u.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>{u.fullName ? `${u.fullName} · ` : ''}{u.email}</span>
                    <ConfirmActionButton variant="outline" label="Remove" confirm={`Remove ${u.email}? They lose the dashboard.`} confirmLabel="Remove person" run={revokeSystemUser.bind(null, u.id)} />
                  </li>
                ))}
              </ul>
              <AddSystemUserForm systemId={s.id} />
            </div>
          </section>
        ))
      ) : (
        <p className="text-sm text-muted-foreground">No systems yet. Most colleges don’t need one; create one when a buyer covers several campuses.</p>
      )}
    </div>
  )
}
