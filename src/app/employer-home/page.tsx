import type { Metadata } from 'next'
import { NOINDEX } from '@/lib/seo/canonical'
import { urlForAppPath } from '@/lib/portal-hosts'
import { EMPLOYER_SECTIONS, type EmployerSectionKey } from '@/lib/employer/sections'
import { bridgeAvailable, issueCsrf } from '@/lib/employer/section-bridge'
import { SectionChooser } from '@/components/employer/SectionChooser'
import { getEmployerAccess } from '@/lib/employer/access'
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

interface HeldEntry {
  key: EmployerSectionKey
  appPath: string
  csrf?: string
}

// One entry per section any signed-in session holds, each with a CSRF token for the person who holds it.
async function heldEntries(): Promise<HeldEntry[]> {
  try {
    const users: PeekedUser[] = []
    for (const portal of ['employer', 'talent'] as const) {
      const u = await peekPortalUser(portal)
      if (u && !users.some((x) => x.id === u.id)) users.push(u)
    }
    const out: HeldEntry[] = []
    for (const u of users) {
      const access = await getEmployerAccess({ userId: u.id, email: u.email })
      const csrf = bridgeAvailable() ? (issueCsrf(u.id) ?? undefined) : undefined
      for (const item of switcherItems(access)) if (!out.some((e) => e.key === item.key)) out.push({ key: item.key, appPath: item.appPath, ...(csrf ? { csrf } : {}) })
    }
    return EMPLOYER_SECTIONS.flatMap((s) => out.filter((e) => e.key === s.key))
  } catch {
    return []
  }
}

const SWITCH_NOTICE: Record<string, string> = {
  expired: 'That page was open too long. Choose the section again.',
  signed_out: 'You are signed out. Log in to the section you want.',
  no_access: 'Your account does not have access to that section.',
  unavailable: 'We could not switch sections. Log in to the section you want, or try again in a few minutes.',
}

export default async function EmployerHome({ searchParams }: { searchParams: Promise<{ switch?: string }> }) {
  const notice = SWITCH_NOTICE[(await searchParams).switch ?? '']
  const entries = await heldEntries()
  if (entries.length) {
    return (
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-12">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Your employer sections</h1>
          <p className="text-muted-foreground">These are the parts of NextChapter you work in.</p>
          {notice && (
            <p role="alert" className="rounded-md border border-border bg-muted px-3 py-2 text-sm">
              {notice}
            </p>
          )}
        </div>
        <SectionChooser
          entries={entries.map((e) => ({ key: e.key, href: urlForAppPath(e.appPath), action: `Open ${EMPLOYER_SECTIONS.find((s) => s.key === e.key)?.label}`, csrf: e.csrf }))}
        />
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">NextChapter for employers</h1>
        <p className="text-muted-foreground">Hiring, current employees and outplacement, with one partner.</p>
        {notice && (
          <p role="alert" className="rounded-md border border-border bg-muted px-3 py-2 text-sm">
            {notice}
          </p>
        )}
      </div>
      <SectionChooser entries={EMPLOYER_SECTIONS.map((s) => ({ key: s.key, href: urlForAppPath(s.signInPath), action: `Log in to ${s.label}` }))} />
    </main>
  )
}
