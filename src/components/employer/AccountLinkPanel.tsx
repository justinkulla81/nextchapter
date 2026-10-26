'use client'

import { useState, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import { cn } from '@/lib/utils'

export interface AccountLinkItem {
  id: string
  status: 'ACTIVE' | 'PENDING'
  maskedEmail: string | null
  asker: boolean
}

function PendingButton({ children, pendingText, className }: { children: ReactNode; pendingText: string; className: string }) {
  const { pending } = useFormStatus()
  // While the request runs the button says so and the cursor shows it is busy (design principle: busy cursor on click).
  return (
    <button type="submit" disabled={pending} aria-disabled={pending} className={cn(className, pending && 'cursor-wait opacity-80')}>
      {pending ? pendingText : children}
    </button>
  )
}

const PRIMARY = 'inline-flex w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90'
const SECONDARY = 'inline-flex w-fit rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted'
const DESTRUCTIVE = 'inline-flex w-fit rounded-md border border-destructive px-4 py-2 text-sm font-medium text-destructive hover:bg-muted'

function RemoveForm({ link, csrf }: { link: AccountLinkItem; csrf: string }) {
  const [confirming, setConfirming] = useState(false)
  const active = link.status === 'ACTIVE'
  if (!confirming) {
    return (
      <button type="button" className={SECONDARY} onClick={() => setConfirming(true)}>
        {active ? 'Unlink account' : 'Cancel request'}
      </button>
    )
  }
  return (
    <form method="post" action="/api/employer/account-link" className="space-y-2">
      <input type="hidden" name="action" value="remove" />
      <input type="hidden" name="csrf" value={csrf} />
      <input type="hidden" name="linkId" value={link.id} />
      <p className="text-sm">
        {active ? 'After you unlink, the sections of this account no longer show here. Nothing is deleted from either account.' : 'The email we sent will stop working.'}
      </p>
      <div className="flex flex-wrap gap-2">
        {/* The safe choice comes first and has the focus. */}
        <button type="button" autoFocus className={SECONDARY} onClick={() => setConfirming(false)}>
          {active ? 'Keep link' : 'Keep request'}
        </button>
        <PendingButton className={DESTRUCTIVE} pendingText="Removing…">
          {active ? 'Unlink account' : 'Cancel request'}
        </PendingButton>
      </div>
    </form>
  )
}

/**
 * "Using a different email for another section?" A collapsed disclosure on /employer-home. Sends nothing until the person
 * asks. Every action posts to /api/employer/account-link, which answers with a notice on the page.
 */
export function AccountLinkPanel({ csrf, links }: { csrf: string; links: AccountLinkItem[] }) {
  const active = links.filter((l) => l.status === 'ACTIVE')
  const pending = links.filter((l) => l.status === 'PENDING')
  return (
    <details className="rounded-lg border border-border p-4">
      <summary className="cursor-pointer text-sm font-medium">
        Using a different email for another section?
      </summary>
      <div className="mt-4 space-y-6">
        <p className="text-sm text-muted-foreground">
          If you hold sections under two sign-in emails, link them once and both show on this page. Linking does not merge the accounts or change any role.
        </p>

        <section aria-labelledby="linked-heading" className="space-y-2">
          <h2 id="linked-heading" className="text-sm font-semibold">
            Linked accounts
          </h2>
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground">No linked accounts yet.</p>
          ) : (
            <ul className="space-y-3">
              {active.map((l) => (
                <li key={l.id} className="space-y-2">
                  <p className="text-sm">Linked to {l.maskedEmail ?? 'another account'}</p>
                  <RemoveForm link={l} csrf={csrf} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {pending.length > 0 && (
          <section aria-labelledby="pending-heading" className="space-y-2">
            <h2 id="pending-heading" className="text-sm font-semibold">
              Waiting for confirmation
            </h2>
            <ul className="space-y-3">
              {pending.map((l) => (
                <li key={l.id} className="space-y-2">
                  <p className="text-sm">We emailed {l.maskedEmail ?? 'the other address'}. Open the email while signed in here to finish. It works once and expires soon.</p>
                  <RemoveForm link={l} csrf={csrf} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <form method="post" action="/api/employer/account-link" className="space-y-2">
          <input type="hidden" name="action" value="request" />
          <input type="hidden" name="csrf" value={csrf} />
          <label htmlFor="other-account-email" className="block text-sm font-medium">
            Email of your other account
          </label>
          <input
            id="other-account-email"
            name="email"
            type="email"
            required
            autoComplete="off"
            className="block w-full max-w-sm rounded-md border border-border bg-background px-3 py-2 text-sm"
            aria-describedby="other-account-help"
          />
          <p id="other-account-help" className="text-xs text-muted-foreground">
            We email a one-time link to that address. It must already have a NextChapter account.
          </p>
          <PendingButton className={PRIMARY} pendingText="Sending…">
            Send confirmation email
          </PendingButton>
        </form>
      </div>
    </details>
  )
}
