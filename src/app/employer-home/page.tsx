import type { Metadata } from 'next'
import { NOINDEX } from '@/lib/seo/canonical'
import { urlForAppPath } from '@/lib/portal-hosts'
import { EMPLOYER_SECTIONS } from '@/lib/employer/sections'
import { SectionChooser } from '@/components/employer/SectionChooser'
import { getEmployerAccess, type EmployerAccess } from '@/lib/employer/access'
import { switcherItems } from '@/lib/employer/section-links'
import { peekPortalUser, type PeekedUser } from '@/lib/supabase/peek-session'

export const metadata: Metadata = { ...NOINDEX, title: 'NextChapter for employers' }

// The employer portal's front door (employer.<site>), and the section chooser.
//
// Signed out: the three sections (Hiring, Employees, Outplacement) with a log in link for each.
// Signed in with at least one section: only the sections that person holds, each with one button to open it.
//
// Who is signed in is read with peekPortalUser, which never refreshes or writes a session cookie: the proxy does not
// refresh the employer or hiring cookie on this path, so a normal server client could spend a refresh token it cannot
// save. An expired session just shows the signed-out view, and each section's own login and pages work as they always did.
export const dynamic = 'force-dynamic'

async function heldAccess(): Promise<EmployerAccess | null> {
  try {
    const users: PeekedUser[] = []
    for (const portal of ['employer', 'talent'] as const) {
      const u = await peekPortalUser(portal)
      if (u && !users.some((x) => x.id === u.id)) users.push(u)
    }
    if (!users.length) return null
    const all = await Promise.all(users.map((u) => getEmployerAccess({ userId: u.id, email: u.email })))
    const sections = EMPLOYER_SECTIONS.map((s) => s.key).filter((k) => all.some((a) => a.sections.includes(k)))
    return sections.length ? { userId: users[0].id, sections, grants: all.flatMap((a) => a.grants) } : null
  } catch {
    return null
  }
}

export default async function EmployerHome() {
  const access = await heldAccess()
  if (access) {
    const items = switcherItems(access)
    return (
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-12">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Your employer sections</h1>
          <p className="text-muted-foreground">These are the parts of NextChapter you work in.</p>
        </div>
        <SectionChooser entries={items.map((i) => ({ key: i.key, href: urlForAppPath(i.appPath), action: `Open ${i.label}` }))} />
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">NextChapter for employers</h1>
        <p className="text-muted-foreground">Hiring, current employees and outplacement, with one partner.</p>
      </div>
      <SectionChooser entries={EMPLOYER_SECTIONS.map((s) => ({ key: s.key, href: urlForAppPath(s.signInPath), action: `Log in to ${s.label}` }))} />
    </main>
  )
}
