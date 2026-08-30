import Link from 'next/link'
import { Lock } from 'lucide-react'
import { GoogleConnectPrompt } from '@/components/dashboard/GoogleConnectPrompt'
import { CsvImportForm } from '@/components/dashboard/CsvImportForm'
import { buttonVariants } from '@/components/ui/button'

// Full-page replacement for {children} in dashboard/layout.tsx while a
// subjectToHardGate candidate hasn't cleared the gate yet — see
// src/lib/dashboard/access-gate.ts. Always states exactly what's missing and
// what to do about it (design-principles.md: never disable without
// explaining why + what unlocks it), same visual language as
// LockedFeatureNotice (Lock icon, orange accent) scaled up to a full page.
export function HardGateBlockingScreen({
  stage,
  candidateId,
  email,
}: {
  stage: 'search_strategy_required' | 'activation_required'
  candidateId: string
  email: string | null
}) {
  if (stage === 'search_strategy_required') {
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-lg border border-dashed border-light-gray bg-off-white p-6 text-center">
        <div className="flex items-center justify-center gap-2">
          <Lock className="size-5 text-orange" />
          <p className="text-sm font-semibold text-orange">Last step — Search Strategy</p>
        </div>
        <p className="text-sm text-muted-foreground">
          Now that Gmail and LinkedIn are connected, we need your Search Strategy — target role,
          industries, company preferences, and what tends to get in the way for you. It takes
          about 5 minutes and everything after this is personalized to it.
        </p>
        <Link href="/dashboard/search-strategy" className={buttonVariants({ variant: 'default' })}>
          Complete Search Strategy
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 rounded-lg border border-dashed border-light-gray bg-off-white p-6 text-center">
      <div className="flex items-center justify-center gap-2">
        <Lock className="size-5 text-orange" />
        <p className="text-sm font-semibold text-orange">Activate your Search Plan</p>
      </div>
      <p className="text-sm text-muted-foreground">
        Before anything else: connect Gmail so we can track your outreach and interviews
        automatically, and import your LinkedIn connections so we can build your networking list.
        Both are one-time and take a couple minutes — then we&apos;ll walk through your Search
        Strategy.
      </p>
      <div className="space-y-4 text-left">
        <GoogleConnectPrompt candidateId={candidateId} email={email} returnTo="/dashboard" />
        <div className="rounded-lg border border-border bg-white p-4">
          <p className="mb-2 text-sm font-medium text-foreground">Import LinkedIn connections</p>
          <CsvImportForm />
        </div>
      </div>
    </div>
  )
}
