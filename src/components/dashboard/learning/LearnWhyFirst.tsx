import { ExposureCredit } from '@/components/candidate/AiExposure'
import type { LearnWhy } from '@/lib/redesign/learn-exposure-why'

// "Why this first" inside the featured course: what AI use is observed in the member's occupation, what postings ask
// for, and (when it is true) that AI skills pay more like-for-like. No color codes the need.
export function LearnWhyFirst({ why }: { why: LearnWhy }) {
  return (
    <div className="space-y-2 rounded-xl bg-muted/70 p-4">
      <h3 className="text-sm font-semibold text-ink">Why this first: AI at work in your role</h3>
      <p className="text-base text-ink">{why.lead}</p>
      {why.facts.map((f) => (
        <p key={f} className="text-base text-ink">{f}</p>
      ))}
      {why.footnote && <p className="text-sm text-muted-foreground">{why.footnote}</p>}
      {why.showCredit && <ExposureCredit />}
    </div>
  )
}
