import type { Metadata } from 'next'
import { ContestForm } from '@/components/crucible/employers/ContestForm'

export const metadata: Metadata = {
  title: { absolute: 'noexperienceneeded.ai — New contest' },
  robots: { index: false, follow: false },
}

export default function NewCrucibleContestPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New contest</h1>
        <p className="mt-1 text-muted-foreground">
          Post a real business problem. Qualified candidates get an email invite to respond — no account
          needed on their end.
        </p>
      </div>
      <ContestForm />
    </div>
  )
}
