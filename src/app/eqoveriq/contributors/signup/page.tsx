import type { Metadata } from 'next'
import { ContributorSignupForm } from '@/components/eqoveriq/contributors/ContributorSignupForm'

export const metadata: Metadata = {
  title: { absolute: 'EQoverIQ — Apply as a contributor' },
  robots: { index: false, follow: false },
}

export default function EqOverIqContributorSignupPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <div className="mb-8 space-y-2">
        <p className="text-sm font-medium text-muted-foreground">EQoverIQ for Contributors</p>
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-muted-foreground">
          One quick step to create your account, then you&apos;ll complete a short application.
        </p>
      </div>
      <ContributorSignupForm />
    </div>
  )
}
