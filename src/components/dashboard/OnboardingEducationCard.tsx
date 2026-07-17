'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

const DISMISS_KEY = 'nc_onboarding_education_dismissed'

// Client-only dismissal (localStorage, not a DB field) — this is orientation
// content for a first-time visitor, not a state that needs to sync across
// devices or survive a database migration.
export function OnboardingEducationCard() {
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    // One-time sync from an external system (localStorage) on mount, not a
    // derived-state loop — the sanctioned case this lint rule doesn't model.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(localStorage.getItem(DISMISS_KEY) === 'true')
  }, [])

  if (dismissed) return null

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, 'true')
    setDismissed(true)
  }

  return (
    <Card className="border-brand/30 bg-brand/5">
      <CardContent className="relative space-y-2 pt-6">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
        <h2 className="text-sm font-semibold text-navy">How NextChapter works</h2>
        <ul className="space-y-1.5 text-sm text-foreground">
          <li>
            <span className="font-medium">Market Reality Grade</span> — an honest read on where you
            stand today. It moves only when you re-assess, not from weekly activity.
          </li>
          <li>
            <span className="font-medium">Weekly Search Score</span> — your grade for this week&apos;s
            effort, earned one point at a time from real Search Actions.
          </li>
          <li>
            <span className="font-medium">Weekly Search Sprint</span> — the actions you commit to each
            week, shown right on this dashboard.
          </li>
          <li>
            <span className="font-medium">Dossier</span> — a verified profile built from your
            references and work, that shows hiring managers what your resume can&apos;t.
          </li>
        </ul>
        <p className="text-xs text-muted-foreground">
          Start with this week&apos;s Sprint below — Victoria&apos;s here if you want to talk through it.
        </p>
      </CardContent>
    </Card>
  )
}
