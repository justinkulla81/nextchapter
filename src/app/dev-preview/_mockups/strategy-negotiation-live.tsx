import { PreviewShell } from '@/components/candidate/PreviewShell'
import { NegotiationCompensationForm } from '@/components/dashboard/NegotiationCompensationForm'

// Search Strategy step 5 as built: the real form with sample answers. Two comfort
// questions are needed, the lowest pay is optional, and the benefits moved to the Pay page.
export function StrategyNegotiationLive({ empty = false }: { empty?: boolean }) {
  return (
    <PreviewShell place="home" entry="tailored">
      <div className="mx-auto max-w-3xl space-y-4">
        <p className="text-xs text-muted-foreground">5 of 6 — Negotiation, Interview &amp; Compensation Readiness</p>
        <NegotiationCompensationForm
          candidateId="preview"
          negotiationComfort={empty ? null : 50}
          interviewComfort={empty ? null : 75}
          targetCompMin={empty ? null : 210000}
        />
      </div>
    </PreviewShell>
  )
}
export const StrategyNegotiationEmptyLive = () => <StrategyNegotiationLive empty />
