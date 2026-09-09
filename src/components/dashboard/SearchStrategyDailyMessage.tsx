import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Dashboard daily-message override for as long as a candidate hasn't
// finished Search Strategy — the one thing the hard gate actually requires
// (see access-gate.ts). Takes priority over PreConnectDailyMessage: Search
// Strategy is the real first step, not connecting Gmail/LinkedIn, which are
// now optional per-feature unlocks (DashboardNav.tsx) rather than a
// prerequisite to anything. Framed around WHY this matters — the
// foundation everything downstream gets tailored from — not just "fill out
// this form."
export function SearchStrategyDailyMessage({ firstName }: { firstName: string }) {
  return (
    <Card className="border-brand/30 bg-brand/5">
      <CardContent className="space-y-2">
        <p className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">Daily Message</p>
        <p className="text-sm font-semibold text-navy">Welcome, {firstName}!</p>
        <p className="text-sm text-foreground">
          First step: your <strong>Search Strategy</strong> — target role, industries, company
          preferences, and what tends to get in the way for you. This is what tailors everything
          else specifically to you: your action plan, your job matches, and — as you build
          evidence over time — your Certified Executive Dossier all get personalized from what
          you tell us here. About 5 minutes.
        </p>
        <Link href="/dashboard/search-strategy" className={cn(buttonVariants({ variant: 'default' }), 'mt-1')}>
          Complete Search Strategy
        </Link>
      </CardContent>
    </Card>
  )
}
