'use client'

import { usePathname } from 'next/navigation'
import { isGateExemptPath } from '@/lib/dashboard/gate-exempt-paths'
import { HardGateBlockingScreen } from '@/components/dashboard/HardGateBlockingScreen'
import type { HardGateStatus } from '@/lib/dashboard/access-gate'

// The exemption check used to happen server-side in dashboard/layout.tsx,
// reading the pathname off an x-pathname header the middleware forwards
// (see updateSession in src/lib/supabase/middleware.ts) — a real bug this
// closes: that header didn't reliably reach this layout in production, so
// headers().get('x-pathname') sometimes came back empty, isGateExemptPath('')
// is false for every path, and a subjectToHardGate candidate landed on the
// blocking screen even on /dashboard/search-strategy itself — the one page
// whose whole job is to let them clear the gate. usePathname() has no such
// propagation dependency; it reads straight from the router.
export function HardGateGate({
  subjectToHardGate,
  status,
  candidateId,
  email,
  children,
}: {
  subjectToHardGate: boolean
  status: HardGateStatus
  candidateId: string
  email: string | null
  children: React.ReactNode
}) {
  const pathname = usePathname()

  const blocked =
    subjectToHardGate &&
    !isGateExemptPath(pathname) &&
    (status === 'search_strategy_required' || status === 'activation_required')

  if (blocked) {
    return <HardGateBlockingScreen stage={status} candidateId={candidateId} email={email} />
  }

  return <>{children}</>
}
