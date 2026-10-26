import type { Metadata } from 'next'
import { NOINDEX } from '@/lib/seo/canonical'
import { urlForAppPath } from '@/lib/portal-hosts'
import { EMPLOYER_SECTIONS, type EmployerSectionKey } from '@/lib/employer/sections'
import { bridgeAvailable, issueCsrf } from '@/lib/employer/section-bridge'
import { SectionChooser } from '@/components/employer/SectionChooser'
import { getEmployerAccess } from '@/lib/employer/access'
import { switcherItems } from '@/lib/employer/section-links'
import { peekPortalUser, type PeekedUser } from '@/lib/supabase/peek-session'
import { AccountLinkPanel } from '@/components/employer/AccountLinkPanel'
import { linkViewsFor, type LinkView } from '@/lib/employer/account-link-server'

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

interface LinkPanelData {
  csrf: string
  links: LinkView[]
}

// One entry per section any signed-in session holds (their own, and those of accounts they have linked), each with a CSRF
// token for the person who is signed in. `panel` is the "link my other account" data for the first signed-in person, or
// null when nobody is signed in, the bridge is unavailable, or the links table is not there yet.
async function heldEntries(): Promise<{ entries: HeldEntry[]; panel: LinkPanelData | null }> {
  try {
    const users: PeekedUser[] = []
    for (const portal of ['employer', 'talent'] as const) {
      const u = await peekPortalUser(portal)
      if (u && !users.some((x) => x.id === u.id)) users.push(u)
    }
    const out: HeldEntry[] = []
    for (const u of users) {
      const access = await getEmployerAccess({ userId: u.id, email: u.email, includeLinked: true })
      const csrf = bridgeAvailable() ? (issueCsrf(u.id) ?? undefined) : undefined
      for (const item of switcherItems(access)) if (!out.some((e) => e.key === item.key)) out.push({ key: item.key, appPath: item.appPath, ...(csrf ? { csrf } : {}) })
    }
    let panel: LinkPanelData | null = null
    const first = users[0]
    const firstCsrf = first && bridgeAvailable() ? issueCsrf(first.id) : null
    if (first && firstCsrf) {
      const { available, links } = await linkViewsFor(first.id)
      if (available) panel = { csrf: firstCsrf, links }
    }
    return { entries: EMPLOYER_SECTIONS.flatMap((s) => out.filter((e) => e.key === s.key)), panel }
  } catch {
    return { entries: [], panel: null }
  }
}

const SWITCH_NOTICE: Record<string, string> = {
  expired: 'That page was open too long. Choose the section again.',
  signed_out: 'You are signed out. Log in to the section you want.',
  no_access: 'Your account does not have access to that section.',
  unavailable: 'We could not switch sections. Log in to the section you want, or try again in a few minutes.',
}

// What happened to the last "link my other account" action (?link=), said in plain words with the next step.
const LINK_NOTICE: Record<string, string> = {
  sent: 'We emailed a confirmation link to that address. Open it while you are signed in here. It works once and expires in 30 minutes.',
  linked: 'The accounts are linked. The sections of both now show on this page.',
  removed: 'The accounts are unlinked. Nothing was deleted from either account.',
  cancelled: 'The request is cancelled. The email we sent no longer works.',
  invalid_email: 'That does not look like an email address. Check it and try again.',
  same_account: 'That is the account you are signed in to. Enter the email of your other account.',
  no_account: 'We found no NextChapter account for that email. Check the spelling, or sign in once with that email first.',
  not_verified: 'That account has not confirmed its email yet. Confirm it, then try again.',
  already_linked: 'Those accounts are already linked.',
  rate_limited: 'Too many requests. Wait an hour, then try again.',
  send_failed: 'We could not send the email. Try again in a few minutes.',
  token_expired: 'That link has expired. Send a new confirmation email.',
  invalid: 'That link is not valid. Send a new confirmation email.',
  used: 'That link was already used or was replaced. Send a new confirmation email if the accounts are not linked.',
  wrong_user: 'That link was requested from a different account. Sign in to the account you asked from, then open it again.',
  not_found: 'That link was already removed.',
  expired: 'That page was open too long. Reload it and try again.',
  signed_out: 'You are signed out. Sign in, then try again.',
  unavailable: 'We could not do that. Try again in a few minutes.',
}

export default async function EmployerHome({ searchParams }: { searchParams: Promise<{ switch?: string; link?: string }> }) {
  const sp = await searchParams
  const notice = SWITCH_NOTICE[sp.switch ?? ''] ?? LINK_NOTICE[sp.link ?? '']
  const { entries, panel } = await heldEntries()
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
        {panel && <AccountLinkPanel csrf={panel.csrf} links={panel.links.map((l) => ({ id: l.id, status: l.status, maskedEmail: l.maskedEmail, asker: l.asker }))} />}
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
