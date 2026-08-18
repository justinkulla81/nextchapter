'use client'

import { useActionState, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { confirmSkillsHave } from '@/app/dashboard/skills-assessment/actions'
import { Input } from '@/components/ui/input'
import { SubmitButton } from '@/components/ui/submit-button'
import { Label } from '@/components/ui/label'

function computeInitialSkills(resumeKeywords: string[], initialConfirmed: string[], strongAiSkills: boolean) {
  const base = initialConfirmed.length > 0 ? initialConfirmed : resumeKeywords
  if (strongAiSkills && !base.some((s) => s.toLowerCase() === 'ai skills')) {
    return [...base, 'AI skills']
  }
  return base
}

function snapshotOf(skills: string[]) {
  return JSON.stringify([...skills].sort())
}

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
}) {
  const [state, formAction] = useActionState(confirmSkillsHave, undefined)
  const [skills, setSkills] = useState<string[]>(() =>
    computeInitialSkills(resumeKeywords, initialConfirmed, strongAiSkills)
  )
  const [draft, setDraft] = useState('')

  // "Saved" stays gray until the candidate actually changes the list, not
  // just for a fixed 2s window (see SubmitButton's controlled `saved` prop).
  // The snapshot is captured in the form's submit handler (an event, not
  // render) so the success effect below can adopt exactly what was
  // submitted, without reading a ref during render.
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState(() => snapshotOf(skills))
  const [hasSavedBefore, setHasSavedBefore] = useState(initialConfirmed.length > 0)
  const pendingSnapshotRef = useRef<string | null>(null)

  useEffect(() => {
    if (state?.success && pendingSnapshotRef.current !== null) {
      setHasSavedBefore(true)
      setLastSavedSnapshot(pendingSnapshotRef.current)
    }
  }, [state])

  const isDirty = snapshotOf(skills) !== lastSavedSnapshot

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
        pendingSnapshotRef.current = snapshotOf(skills)
        formAction(formData)
      }}
      className="space-y-3"
    >
      <div>
        <Label>2. Skills You Have</Label>
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
      <SubmitButton size="sm" pendingLabel="Saving…" saved={hasSavedBefore && !isDirty}>
        Save
      </SubmitButton>
    </form>
  )
}
