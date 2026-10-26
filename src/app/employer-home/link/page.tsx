import type { Metadata } from 'next'
import { NOINDEX } from '@/lib/seo/canonical'
import { urlForAppPath } from '@/lib/portal-hosts'
import { bridgeAvailable, issueCsrf } from '@/lib/employer/section-bridge'
import { peekPortalUser, type PeekedUser } from '@/lib/supabase/peek-session'
import { prisma } from '@/lib/prisma'
import { previewLinkToken, type LinkTokenState } from '@/lib/employer/account-link'
import { PendingSubmit } from '@/components/employer/PendingSubmit'

export const metadata: Metadata = { ...NOINDEX, title: 'Confirm account link', referrer: 'no-referrer' }
export const dynamic = 'force-dynamic'

// Where the emailed link lands. Opening it changes nothing: the link is recorded only when the signed-in person presses
// the button, which posts to /api/employer/account-link. (Mail scanners that open links therefore cannot use the token up.)
// Who is signed in is read with peekPortalUser, which never refreshes or writes a session cookie.

const PROBLEM: Record<Exclude<LinkTokenState, 'ok'>, string> = {
  invalid: 'This link is not valid. Send a new confirmation email from your employer sections page.',
  expired: 'This link has expired. Send a new confirmation email from your employer sections page.',
  used: 'This link was already used or was replaced. If your accounts are not linked, send a new confirmation email.',
  wrong_user: 'This link was requested from a different account. Sign in to the account you asked from, then open the link again.',
}

export default async function ConfirmAccountLink({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? ''
  const home = urlForAppPath('/employer-home')

  const users: PeekedUser[] = []
  try {
    for (const portal of ['employer', 'talent'] as const) {
      const u = await peekPortalUser(portal)
      if (u && !users.some((x) => x.id === u.id)) users.push(u)
    }
  } catch {
    // Treated as signed out.
  }

  // The signed-in account this link was requested from, if any of the signed-in sessions is it.
  let state: LinkTokenState = 'invalid'
  let user: PeekedUser | null = null
  let unavailable = false
  if (token && users.length) {
    try {
      for (const u of users) {
        const s = await previewLinkToken(prisma, { userId: u.id, token })
        if (s === 'ok') {
          state = s
          user = u
          break
        }
        if (s !== 'wrong_user' || state === 'invalid') state = s
      }
    } catch {
      unavailable = true
    }
  }
  const csrf = user && bridgeAvailable() ? issueCsrf(user.id) : null

  return (
    <main className="mx-auto max-w-xl space-y-6 px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Link your accounts</h1>
      {!users.length ? (
        <div className="space-y-4">
          <p className="text-muted-foreground">Sign in to the account you asked from, then open this link again.</p>
          <a href={home} className="inline-flex w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            Sign in
          </a>
        </div>
      ) : unavailable ? (
        <p role="alert" className="rounded-md border border-border bg-muted px-3 py-2 text-sm">
          We could not check this link right now. Try again in a few minutes.
        </p>
      ) : state === 'ok' && csrf ? (
        <form method="post" action="/api/employer/account-link" className="space-y-4">
          <p className="text-muted-foreground">
            This links the address that received this email with the account you are signed in to. The sections of both will show on your employer sections page. It does not merge the accounts or change any role, and either account can unlink later.
          </p>
          <input type="hidden" name="action" value="confirm" />
          <input type="hidden" name="csrf" value={csrf} />
          <input type="hidden" name="token" value={token} />
          <PendingSubmit pendingText="Linking…">Link the accounts</PendingSubmit>
        </form>
      ) : (
        <div className="space-y-4">
          <p role="alert" className="rounded-md border border-border bg-muted px-3 py-2 text-sm">
            {state === 'ok' ? 'We could not prepare this page. Reload it, or try again in a few minutes.' : PROBLEM[state]}
          </p>
          <a href={home} className="inline-flex w-fit rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
            Go to your employer sections
          </a>
        </div>
      )}
    </main>
  )
}
