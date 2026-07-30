'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { requestNegotiationPracticeFeedback } from '@/app/dashboard/find-my-job/actions'
import type { CounterOfferEvaluation } from '@/lib/negotiation/evaluate-counter-offer'

// Prompt 78 — draft/feedback/redraft practice loop for negotiating a job
// offer, same UI pattern as Interview Prep's PracticeTab (not a new one).
export function NegotiationPracticeTab({ jobPostingId }: { jobPostingId: string }) {
  const [draft, setDraft] = useState('')
  const [evaluation, setEvaluation] = useState<CounterOfferEvaluation | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleGetFeedback = () => {
    if (!draft.trim()) return
    startTransition(async () => {
      const result = await requestNegotiationPracticeFeedback(jobPostingId, draft)
      if (result) setEvaluation(result)
    })
  }

  return (
    <div className={cn('space-y-3 border-t border-border pt-3', isPending && 'cursor-wait [&_*]:cursor-wait')}>
      <p className="font-medium text-foreground">Practice your counter-ask</p>
      <p className="text-sm text-muted-foreground">
        Draft what you&apos;d actually say or write to open this negotiation — Victoria gives you honest
        feedback on clarity and specificity before you send it for real.
      </p>
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Type your counter-ask here…"
        rows={5}
      />
      <Button type="button" size="sm" onClick={handleGetFeedback} disabled={isPending || !draft.trim()}>
        {isPending ? 'Evaluating…' : evaluation ? 'Redraft — get new feedback' : 'Get feedback'}
      </Button>

      {evaluation && (
        <div className="space-y-2 rounded-lg border border-border bg-off-white p-3 text-sm">
          <p>{evaluation.overallAssessment}</p>
          <p>
            <strong>Clarity:</strong> {evaluation.clarityNote}
          </p>
          {evaluation.strengths.length > 0 && (
            <div>
              <strong>What&apos;s working:</strong>
              <ul className="list-disc pl-5">
                {evaluation.strengths.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {evaluation.improvements.length > 0 && (
            <div>
              <strong>To sharpen:</strong>
              <ul className="list-disc pl-5">
                {evaluation.improvements.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
