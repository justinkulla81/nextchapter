import Link from 'next/link'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TierDef {
  key: string
  label: string
  price: string
  plus: boolean
}

// Candidate/Candidate+/Premium/Premium+ — a simple, four-rung "where you
// stand" ladder, distinct from the DTC dtc_* pricing tiers on /dashboard/plans
// and /pricing. The "+" isn't a purchase: it's Dossier-unlocked status
// (isDossierUnlocked) layered on top of whichever base tier you're on.
// Premium itself (the $799/mo bundle at /dashboard/premium) is waitlist-only
// today — nothing charges anyone yet — so the real current position for
// every candidate right now is Candidate or Candidate+, never Premium(+).
const TIERS: TierDef[] = [
  { key: 'candidate', label: 'Candidate', price: 'Free', plus: false },
  { key: 'candidate_plus', label: 'Candidate+', price: 'Free', plus: true },
  { key: 'premium', label: 'Premium', price: '$799/mo · waitlist', plus: false },
  { key: 'premium_plus', label: 'Premium+', price: '$799/mo · waitlist', plus: true },
]

export function MembershipStatusLadder({ dossierUnlocked, reason }: { dossierUnlocked: boolean; reason: string }) {
  const currentKey = dossierUnlocked ? 'candidate_plus' : 'candidate'

  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-sm font-medium text-foreground">Where you stand</p>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {TIERS.map((tier) => {
          const isCurrent = tier.key === currentKey
          return (
            <div key={tier.key} className="flex flex-col items-center gap-1 text-center">
              <div
                className={cn(
                  'flex w-full flex-col items-center gap-0.5 rounded-full border px-2 py-2',
                  isCurrent ? 'border-2 border-brand bg-brand/5' : 'border-border bg-off-white',
                  tier.plus && 'border-dashed'
                )}
              >
                <span className={cn('text-xs font-semibold', isCurrent ? 'text-brand' : 'text-foreground')}>
                  {tier.label}
                </span>
                <span className="text-[11px] text-muted-foreground">{tier.price}</span>
              </div>
              {isCurrent && (
                <span className="flex items-center gap-1 text-[11px] font-medium text-brand">
                  <Check className="size-3" /> You are here
                </span>
              )}
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        A <span className="font-medium text-foreground">+</span> isn&apos;t a purchase — it&apos;s earned when
        your Executive Dossier unlocks (real references and real effort), and it unlocks Exclusive Jobs and
        the Executive Recruiter Network on any plan, free or paid.{' '}
        {dossierUnlocked ? (
          'Your Dossier is unlocked.'
        ) : (
          <>
            {reason}{' '}
            <Link href="/dashboard/portfolio" className="text-primary underline underline-offset-4">
              See what&apos;s left →
            </Link>
          </>
        )}
      </p>
    </div>
  )
}
