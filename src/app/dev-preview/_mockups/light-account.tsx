'use client'

import { AccountReadyForm, type AccountReadyState } from '@/components/onboarding/light/AccountReadyForm'
import { SavedJobsView } from '@/components/onboarding/light/SavedJobsView'
import { Logo } from '@/components/Logo'

// The light account (owner decision 2026-11-18), with sample data: the page the "Open my account" button in a follow-up email
// opens, and the page a light member lands on. Both sit in the onboarding frame (logo header, narrow column).
const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="theme-candidate flex min-h-screen flex-col bg-white">
    <header className="border-b border-border">
      <div className="mx-auto max-w-2xl px-6 py-4">
        <Logo className="text-2xl" />
      </div>
    </header>
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">{children}</main>
  </div>
)

const noop = async (_prev: AccountReadyState): Promise<AccountReadyState> => ({ error: 'Preview only: nothing is saved here.' })

export function LightAccountReady() {
  return (
    <Frame>
      <AccountReadyForm token="preview" jobs={[{ title: 'Communications Coordinator', company: 'Harvesters - The Community Food Network' }]} action={noop} />
    </Frame>
  )
}

export function LightSavedJobs() {
  return (
    <Frame>
      <SavedJobsView
        firstName="Dana"
        startHref="#"
        jobs={[
          { title: 'Communications Coordinator', company: 'Harvesters - The Community Food Network', place: 'Kansas City, MO', href: '#' },
          { title: 'Senior Communications Specialist', company: 'HNTB', place: 'Kansas City, MO', href: '#' },
        ]}
      />
    </Frame>
  )
}
