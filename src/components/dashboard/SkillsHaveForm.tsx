'use client'

import { useActionState, useState, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { confirmSkillsHave } from '@/app/dashboard/skills-assessment/actions'
import { Input } from '@/components/ui/input'
import { SubmitButton } from '@/components/ui/submit-button'
import { Label } from '@/components/ui/label'

// Editable "Skills You Have" — same chip-editing shape as SkillsToBuildForm
// (add/remove/type-to-add), seeded from resumeKeywords rather than starting
// blank. Saves to CandidateProfile.confirmedSkillsHave, a separate field
// from resumeKeywords itself — resumeKeywords stays the untouched,
// auto-refreshed-on-resume-reupload source; this is the candidate's own
// edited copy, so an edit here never gets silently overwritten by a later
// resume upload.
export function SkillsHaveForm({
  resumeKeywords,
  initialConfirmed,
  strongAiSkills,
  onSaved,
}: {
  resumeKeywords: string[]
  initialConfirmed: string[]
  // True when the candidate just rated their own AI skills "Very strong" or
  // "Among the best in my field" on the questionnaire above — auto-adds an
  // "AI skills" chip to the pre-filled list so that self-report shows up
  // here too, not just as a hidden confidence number. Only applied to the
  // initial pre-fill, never re-injected after the candidate has started
  // editing (an explicit removal should stick).
  strongAiSkills: boolean
  onSaved?: () => void
}) {
  const [state, formAction] = useActionState(confirmSkillsHave, undefined)
  const [skills, setSkills] = useState<string[]>(() => {
    const base = initialConfirmed.length > 0 ? initialConfirmed : resumeKeywords
    if (strongAiSkills && !base.some((s) => s.toLowerCase() === 'ai skills')) {
      return [...base, 'AI skills']
    }
    return base
  })
  const [draft, setDraft] = useState('')

  function addSkill(value: string) {
    const trimmed = value.trim()
    if (trimmed && !skills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setSkills((prev) => [...prev, trimmed])
    }
  }

  function addFromDraft() {
    addSkill(draft)
    setDraft('')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addFromDraft()
    } else if (e.key === 'Backspace' && !draft && skills.length > 0) {
      setSkills((prev) => prev.slice(0, -1))
    }
  }

  return (
    <form
      action={(formData) => {
        formAction(formData)
        onSaved?.()
      }}
      className="space-y-3"
    >
      <div>
        <Label>Skills You Have</Label>
        <p className="text-xs text-muted-foreground">
          {resumeKeywords.length > 0
            ? "Pulled from your resume — edit if anything's off, then confirm."
            : (
              <>
                No skills extracted from a resume yet —{' '}
                <Link href="/dashboard/resume" className="text-primary underline underline-offset-4">
                  upload one
                </Link>{' '}
                to pull them in automatically, or add your own below.
              </>
            )}
        </p>
      </div>
      <div className="space-y-2">
        {skills.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {skills.map((skill) => (
              <span
                key={skill}
                className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
              >
                {skill}
                <button
                  type="button"
                  onClick={() => setSkills((prev) => prev.filter((s) => s !== skill))}
                  aria-label={`Remove ${skill}`}
                >
                  <X className="size-3" />
                </button>
                <input type="hidden" name="confirmedSkillsHave" value={skill} />
              </span>
            ))}
          </div>
        )}
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addFromDraft}
          placeholder="Type a skill and press Enter"
        />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton size="sm" pendingLabel="Saving…">
        Confirm
      </SubmitButton>
    </form>
  )
}
