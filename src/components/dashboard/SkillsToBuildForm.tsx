'use client'

import { useActionState, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Plus, X } from 'lucide-react'
import { updateSkillsToBuild } from '@/app/dashboard/skills-assessments/actions'
import { Input } from '@/components/ui/input'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'
import type { SkillGapSuggestions } from '@/lib/skills/skill-gap-suggestions'

function snapshotOf(skills: string[]) {
  return JSON.stringify([...skills].sort())
}

export function SkillsToBuildForm({
  initialSkills,
  suggestions,
  targetRole,
}: {
  initialSkills: string[]
  suggestions: SkillGapSuggestions | null
  // Names the real target role in the group label instead of a generic
  // "your target role" — falls back to that generic phrasing only when the
  // candidate hasn't set one yet (Search Strategy).
  targetRole: string | null
}) {
  const [state, formAction] = useActionState(updateSkillsToBuild, undefined)
  const [skills, setSkills] = useState<string[]>(initialSkills)
  const [draft, setDraft] = useState('')

  // "Saved" stays gray until the candidate actually changes the list, not
  // just for a fixed 2s window (see SubmitButton's controlled `saved` prop).
  // The snapshot is captured in the form's submit handler (an event, not
  // render) so the success effect below can adopt exactly what was
  // submitted, without reading a ref during render.
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState(() => snapshotOf(initialSkills))
  const [hasSavedBefore, setHasSavedBefore] = useState(initialSkills.length > 0)
  const pendingSnapshotRef = useRef<string | null>(null)

  useEffect(() => {
    if (state?.success && pendingSnapshotRef.current !== null) {
      setHasSavedBefore(true)
      setLastSavedSnapshot(pendingSnapshotRef.current)
    }
  }, [state])

  const isDirty = snapshotOf(skills) !== lastSavedSnapshot

  const suggestionGroups: { key: keyof SkillGapSuggestions; label: string }[] = [
    { key: 'resumeGaps', label: 'Common for your background, not on your resume' },
    { key: 'roleGaps', label: targetRole ? `For ${targetRole}` : 'For your target role' },
    { key: 'modernSkills', label: 'Modern & AI skills' },
  ]

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

  const hasSuggestions = suggestionGroups.some((g) => (suggestions?.[g.key]?.length ?? 0) > 0)

  return (
    <form
      action={(formData) => {
        pendingSnapshotRef.current = snapshotOf(skills)
        formAction(formData)
      }}
      className="space-y-4"
    >
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
                <input type="hidden" name="skillsToBuild" value={skill} />
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

      {hasSuggestions && (
        <div className="space-y-3">
          {suggestionGroups.map((group) => {
            const items = suggestions?.[group.key] ?? []
            if (items.length === 0) return null
            return (
              <div key={group.key} className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">{group.label}</p>
                <div className="flex flex-wrap gap-2">
                  {items.map((item) => {
                    const alreadyAdded = skills.some((s) => s.toLowerCase() === item.toLowerCase())
                    return (
                      <button
                        key={item}
                        type="button"
                        disabled={alreadyAdded}
                        onClick={() => addSkill(item)}
                        className={cn(
                          'flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors',
                          alreadyAdded
                            ? 'border-border bg-muted text-muted-foreground'
                            : 'border-brand/30 bg-brand/5 text-brand hover:bg-brand/10'
                        )}
                      >
                        {alreadyAdded ? item : <><Plus className="size-3" />{item}</>}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton size="sm" pendingLabel="Saving…" saved={hasSavedBefore && !isDirty}>
        Save
      </SubmitButton>
    </form>
  )
}
