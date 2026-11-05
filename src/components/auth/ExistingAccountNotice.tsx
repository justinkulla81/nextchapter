import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Shared "you already have an account" messaging — shown wherever a
// duplicate-account check finds a match (resume upload, create-account form,
// or the create-account page itself after an authoritative block), so the
// copy and the two possible next steps (log in vs. finish setting a
// password) stay consistent no matter which check caught it.
export function ExistingAccountNotice({
  needsPassword,
  email,
  next,
}: {
  needsPassword: boolean
  email?: string | null
  /** Where to land after logging in (a path on this site). */
  next?: string
}) {
  if (needsPassword) {
    return (
      <div className="space-y-3 rounded-lg border border-border p-4">
        <p className="text-sm text-foreground">
          You&apos;ve already started with this email, but never finished setting a password —
          let&apos;s get that done so you can log back in, instead of starting over.
        </p>
        <Link
          href={`/auth/forgot-password?email=${encodeURIComponent(email ?? '')}`}
          className="inline-block text-sm font-medium text-primary underline underline-offset-4"
        >
          Set my password
        </Link>
      </div>
    )
  }

  const qs = new URLSearchParams()
  if (email) qs.set('email', email)
  if (next) qs.set('next', next)
  const query = qs.toString()
  return (
    <div className="space-y-4 rounded-2xl border border-border bg-white p-6">
      <p className="text-base text-foreground">
        {email ? <>An account with <span className="font-medium">{email}</span> already exists.</> : 'An account with this email already exists.'} Log in to pick up where you left off.
      </p>
      <Link href={`/auth/login${query ? `?${query}` : ''}`} className={cn(buttonVariants({ size: 'lg' }), 'h-11 rounded-full bg-action px-6 text-action-foreground hover:brightness-95')}>
        Log in
      </Link>
      <p className="text-sm text-muted-foreground">
        Forgot your password?{' '}
        <Link href={`/auth/forgot-password?email=${encodeURIComponent(email ?? '')}`} className="font-medium text-primary underline underline-offset-4">
          Reset it
        </Link>
      </p>
    </div>
  )
}
