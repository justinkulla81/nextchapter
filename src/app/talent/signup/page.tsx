import type { Metadata } from 'next'
import { TalentSignupForm } from '@/components/talent/TalentSignupForm'

export const metadata: Metadata = {
  title: 'Create your free employer account',
  robots: { index: false, follow: false },
}

export default function TalentSignupPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <div className="mb-8 space-y-2">
        <p className="text-sm font-medium text-muted-foreground">NextChapter for Employers</p>
        <h1 className="text-2xl font-semibold tracking-tight">Create your free account</h1>
        <p className="text-muted-foreground">
          Post a role and see verified candidates in about 5 minutes. No credit card, no
          subscription.
        </p>
      </div>
      <TalentSignupForm />
    </div>
  )
}
