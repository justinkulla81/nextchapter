'use client'

import { useActionState } from 'react'
import { submitLinkedInProfileGrade } from '@/app/dashboard/marketing-plan/actions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ResumeFeedbackCard } from '@/components/dashboard/ResumeFeedbackCard'
import { cn } from '@/lib/utils'

export interface LinkedInProfileGradeData {
  pastedText: string
  headlineScore: number | null
  headlineFeedback: unknown
  aboutScore: number | null
  aboutFeedback: unknown
  experienceScore: number | null
  experienceFeedback: unknown
  analysisError: string | null
}

function asFeedbackItems(value: unknown): { issue: string; action: string }[] {
  return value as { issue: string; action: string }[]
}

// No public LinkedIn scraping API exists, so this is paste-in-text, not a
// live profile fetch — see grade-profile.ts. One row per candidate; a
// re-grade overwrites the prior result and is cooldown-limited server-side
// (submitLinkedInProfileGrade) since every submit is a real Claude call.
export function LinkedInProfileGraderForm({ existing }: { existing: LinkedInProfileGradeData | null }) {
  const [state, formAction, pending] = useActionState(submitLinkedInProfileGrade, undefined)
  const hasResults = existing && existing.headlineScore !== null

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <div>
        <p className="font-medium text-foreground">LinkedIn Profile Grader</p>
        <p className="text-sm text-muted-foreground">
          Paste your headline, About section, and experience bullets below — no LinkedIn connection needed.
          Graded the same honest, specific way your resume is.
        </p>
      </div>

      <form action={formAction} className={cn('space-y-3', pending && 'cursor-wait [&_*]:cursor-wait')}>
        <Textarea
          name="pastedText"
          rows={8}
          required
          defaultValue={existing?.pastedText ?? ''}
          placeholder="Paste your LinkedIn headline, About section, and experience bullets here…"
        />
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? 'Grading…' : hasResults ? 'Re-grade my profile' : 'Grade my profile'}
        </Button>
      </form>

      {existing?.analysisError && !hasResults && (
        <p className="text-sm text-destructive">{existing.analysisError}</p>
      )}

      {hasResults && (
        <div className="space-y-4 border-t border-border pt-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Headline</p>
            {asFeedbackItems(existing.headlineFeedback).map((item, i) => (
              <ResumeFeedbackCard key={i} item={item} />
            ))}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">About</p>
            {asFeedbackItems(existing.aboutFeedback).map((item, i) => (
              <ResumeFeedbackCard key={i} item={item} />
            ))}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Experience</p>
            {asFeedbackItems(existing.experienceFeedback).map((item, i) => (
              <ResumeFeedbackCard key={i} item={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
