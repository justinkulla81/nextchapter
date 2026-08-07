'use client'

import { useState, useTransition } from 'react'
import { X } from 'lucide-react'
import { dismissAiContextBanner } from '@/app/dashboard/learning/actions'
import { AI_TRAINING_TIER_LABELS, type AiTrainingTier } from '@/lib/constants/ai-training-tiers'

// One line naming what we already know about the candidate's own AI
// comfort (from the aiFlexibilityLevel question in onboarding — the same
// signal that picks the default AI Training tier below), and one line on
// why it matters for the specific role they're targeting, not a generic
// "AI is important" statement every candidate would get regardless of fit.
const COMFORT_SUMMARY: Record<AiTrainingTier, string> = {
  foundational: "you told us you're still getting comfortable with AI day to day",
  practical: "you told us you're comfortable using AI tools for real work",
  technical: "you told us you're already building with AI, not just using it",
}

export function AiContextBanner({
  tier,
  role,
  dismissedAlready,
}: {
  tier: AiTrainingTier
  role: string | null
  dismissedAlready: boolean
}) {
  const [dismissed, setDismissed] = useState(dismissedAlready)
  const [, startTransition] = useTransition()

  if (dismissed) return null

  function dismiss() {
    setDismissed(true)
    startTransition(() => {
      dismissAiContextBanner()
    })
  }

  return (
    <div className="relative space-y-2 rounded-lg border border-brand/30 bg-brand/5 p-4">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss AI context"
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
      >
        <X className="size-4" />
      </button>
      <h2 className="pr-6 text-sm font-medium text-foreground">Where you stand with AI</h2>
      <p className="text-sm text-foreground">
        Based on {COMFORT_SUMMARY[tier]} — that&apos;s why {AI_TRAINING_TIER_LABELS[tier]} is your starting tier
        below, though all three stay open to try.
      </p>
      <p className="text-sm text-foreground">
        {role
          ? `For a ${role} search specifically, hiring managers increasingly expect a candidate to name a real AI tool they use and how — not just say "I'm open to learning it."`
          : 'Across almost every function now, hiring managers expect a candidate to name a real AI tool they use and how — not just say "I\'m open to learning it."'}
        {' '}
        That&apos;s what the tools and courses below are for.
      </p>
    </div>
  )
}
