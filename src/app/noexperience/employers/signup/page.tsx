import type { Metadata } from 'next'
import { EmployerSignupForm } from '@/components/crucible/employers/EmployerSignupForm'

export const metadata: Metadata = {
  title: { absolute: 'noexperienceneeded.ai — Create your free employer account' },
  robots: { index: false, follow: false },
}

export default function CrucibleEmployerSignupPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <div className="mb-8 space-y-2">
        <p className="text-sm font-medium text-muted-foreground">noexperienceneeded.ai for Employers</p>
        <h1 className="text-2xl font-semibold tracking-tight">Create your free account</h1>
        <p className="text-muted-foreground">
          Browse every candidate who passed the assessment and chose to share their resume — free,
          no credit card.
        </p>
      </div>
      <EmployerSignupForm />
    </div>
  )
}
