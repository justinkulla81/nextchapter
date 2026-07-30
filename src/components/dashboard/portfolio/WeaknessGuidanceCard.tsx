'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { WeaknessGuidance } from '@/lib/narrative/detect-narrative-weaknesses'
import { updateGapExplanation } from '@/app/dashboard/portfolio/actions'

export function WeaknessGuidanceCard({
  guidance,
  showGapForm,
  gapExplanation,
  includeGapExplanationInDossier,
}: {
  guidance: WeaknessGuidance[]
  showGapForm: boolean
  gapExplanation?: string | null
  includeGapExplanationInDossier?: boolean
}) {
  const [draft, setDraft] = useState(gapExplanation ?? '')
  const [includeInDossier, setIncludeInDossier] = useState(!!includeGapExplanationInDossier)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  if (guidance.length === 0) return null

  const hasGap = guidance.some((g) => g.flag === 'unexplained_gap')

  const handleSave = () => {
    startTransition(async () => {
      await updateGapExplanation(draft, includeInDossier)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  return (
    <Card className={cn(isPending && 'cursor-wait [&_*]:cursor-wait')}>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Things to be ready to explain
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          A few things a hiring manager might ask about — not part of your pitch, just prep so
          nothing catches you off guard.
        </p>
        <ul className="space-y-2">
          {guidance.map((g) => (
            <li key={g.flag} className="rounded-lg border border-border p-3 text-sm">
              <p className="font-medium text-foreground">{g.label}</p>
              <p className="mt-1 text-muted-foreground">{g.suggestion}</p>
            </li>
          ))}
        </ul>

        {showGapForm && hasGap && (
          <div className="space-y-2 rounded-lg border border-border bg-off-white p-3">
            <Label htmlFor="gap-explanation">Your own words on the gap (optional)</Label>
            <Textarea
              id="gap-explanation"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="What you did with the time, what you learned or accomplished, why you haven't gone stale — e.g. freelance work, a course, volunteering."
              rows={4}
            />
            <div className="flex items-center gap-2">
              <Checkbox
                id="include-gap-dossier"
                checked={includeInDossier}
                onCheckedChange={(checked) => setIncludeInDossier(checked === true)}
              />
              <Label htmlFor="include-gap-dossier" className="font-normal">
                Include this when I share my profile with a recruiter or hiring manager
              </Label>
            </div>
            <Button type="button" size="sm" onClick={handleSave} disabled={isPending}>
              {isPending ? 'Saving…' : saved ? 'Saved' : 'Save'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
