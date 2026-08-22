'use client'

import Link from 'next/link'
import { useFormStatus } from 'react-dom'
import { EqOverIqWordmark } from '@/components/eqoveriq/EqOverIqWordmark'
import { signOutEqOverIqContributor } from '@/app/eqoveriq/contributors/actions'

function SignOutButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="text-sm text-muted-foreground hover:text-foreground">
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  )
}

// No links array, unlike CrucibleEmployerNav — v1 has exactly one
// destination (the status page itself), so there's nothing else to
// navigate between yet.
export function ContributorNav() {
  return (
    <header className="border-b border-border bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
        <Link href="/eqoveriq/contributors">
          <EqOverIqWordmark className="text-lg" />
        </Link>
        <form action={signOutEqOverIqContributor}>
          <SignOutButton />
        </form>
      </div>
    </header>
  )
}
