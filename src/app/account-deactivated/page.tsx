import type { Metadata } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/Logo'

export const metadata: Metadata = { title: 'Account Deactivated — NextChapter' }

export default function AccountDeactivatedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-off-white px-6 text-center">
      <Link href="/">
        <Logo />
      </Link>
      <div className="mt-8 max-w-md space-y-3">
        <h1 className="text-xl font-semibold text-navy">Your account is deactivated</h1>
        <p className="text-sm text-muted-foreground">
          You deactivated your NextChapter account, so it&apos;s currently unusable — nothing was
          deleted, and your profile, resume, references, and reports are all still there.
        </p>
        <p className="text-sm text-muted-foreground">
          To reactivate it, or to have your account and data permanently deleted instead, email{' '}
          <a
            href="mailto:support@launchyournextchapter.com"
            className="text-primary underline underline-offset-4"
          >
            support@launchyournextchapter.com
          </a>
          .
        </p>
      </div>
    </div>
  )
}
