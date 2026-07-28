import Link from 'next/link'

// Shared "you already have an account" messaging — shown wherever a
// duplicate-account check finds a match (resume upload, create-account form,
// or the create-account page itself after an authoritative block), so the
// copy and the two possible next steps (log in vs. finish setting a
// password) stay consistent no matter which check caught it.
export function ExistingAccountNotice({
  needsPassword,
  email,
}: {
  needsPassword: boolean
  email?: string | null
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

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <p className="text-sm text-foreground">
        Looks like you already have an account with this email — log in instead of starting a
        new one.
      </p>
      <Link
        href={`/auth/login${email ? `?email=${encodeURIComponent(email)}` : ''}`}
        className="inline-block text-sm font-medium text-primary underline underline-offset-4"
      >
        Log in
      </Link>
    </div>
  )
}
