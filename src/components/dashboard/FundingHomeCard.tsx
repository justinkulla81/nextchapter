import Link from 'next/link'
import { after } from 'next/server'
import type { CandidateProfile } from '@prisma/client'
import { fundingFor } from '@/lib/benefits/member'
import { captureServerEvent } from '@/lib/posthog/server'

// One slim card on Home that says what funding the member may qualify for and opens the full ranked list.
export async function FundingHomeCard({ profile }: { profile: CandidateProfile }) {
  const f = await fundingFor(profile)
  if (f.matches.length === 0) return null
  const top = f.matches.slice(0, 3)
  after(() => captureServerEvent(profile.id, 'funding_card_shown', { matchCount: f.matches.length, topProgramId: top[0].program.id, hasState: !!f.facts.state }))
  return (
    <section className="space-y-2 rounded-2xl border border-border p-5" aria-labelledby="home-funding">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="home-funding" className="font-display text-xl font-semibold text-ink">
          {f.matches.length} funding programs fit you
        </h2>
        <Link href="/dashboard/funding" className="text-sm font-semibold text-brand underline underline-offset-4">
          See your matches
        </Link>
      </div>
      <p className="text-sm text-muted-foreground">Money to move, retrain and learn. Best fits first: {top.map((m) => m.program.name.replace(/\s*\(.*$/, '')).join(', ')}.</p>
    </section>
  )
}
