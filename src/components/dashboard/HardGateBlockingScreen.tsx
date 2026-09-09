import Link from 'next/link'
import { Lock } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'

// Full-page replacement for {children} in dashboard/layout.tsx while a
// subjectToHardGate candidate hasn't cleared the gate yet — see
// src/lib/dashboard/access-gate.ts. Search Strategy is the only remaining
// stage (Gmail/LinkedIn "activation" used to block here first — removed so
// connecting those is never a prerequisite to anything, just an optional
// per-feature unlock; see DashboardNav.tsx). Always states exactly what's
// missing and why (design-principles.md: never disable without explaining
// why + what unlocks it), same visual language as LockedFeatureNotice (Lock
// icon, orange accent) scaled up to a full page.
export function HardGateBlockingScreen({ stage }: { stage: 'search_strategy_required' }) {
  void stage // only one stage exists today — kept as a prop so a future stage can be added without touching every call site
  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-lg border border-dashed border-light-gray bg-off-white p-6 text-center">
      <div className="flex items-center justify-center gap-2">
        <Lock className="size-5 text-orange" />
        <p className="text-sm font-semibold text-orange">First step — Search Strategy</p>
      </div>
      <p className="text-sm text-muted-foreground">
        This is where your job transition gets tailored to you: target role, industries, company
        preferences, and what tends to get in the way for you. It&apos;s the foundation everything
        else builds on — your action plan, your job matches, and eventually your Certified
        Executive Dossier all get personalized from what you tell us here. It takes about 5
        minutes.
      </p>
      <Link href="/dashboard/search-strategy" className={buttonVariants({ variant: 'default' })}>
        Complete Search Strategy
      </Link>
    </div>
  )
}
