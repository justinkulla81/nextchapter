'use client'

import { useEffect, useState, useTransition, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { Plus, X } from 'lucide-react'
import { confirmSkillsHave, fetchSkillGapSuggestions } from '@/app/dashboard/skills-assessment/actions'
import { updateSkillsToBuild } from '@/app/dashboard/skills-assessments/actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import type { SkillGapSuggestions } from '@/lib/skills/skill-gap-suggestions'

function computeInitialSkillsHave(resumeKeywords: string[], initialConfirmed: string[], strongAiSkills: boolean) {
  const base = initialConfirmed.length > 0 ? initialConfirmed : resumeKeywords
  if (strongAiSkills && !base.some((s) => s.toLowerCase() === 'ai skills')) {
    return [...base, 'AI skills']
  }
  return base
}

// A reusable chip editor — the same add/remove/type-to-add shape
// SkillsHaveForm and SkillsToBuildForm each built independently before this
// page became a two-step wizard with one "Confirm" instead of two "Save"
// buttons.
function ChipEditor({
  skills,
  onAdd,
  onRemove,
}: {
  skills: string[]
  onAdd: (value: string) => void
  onRemove: (value: string) => void
}) {
  const [draft, setDraft] = useState('')

  function addFromDraft() {
    const trimmed = draft.trim()
    if (trimmed) onAdd(trimmed)
    setDraft('')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addFromDraft()
    } else if (e.key === 'Backspace' && !draft && skills.length > 0) {
      onRemove(skills[skills.length - 1])
    }
  }

  return (
    <div className="space-y-2">
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {skills.map((skill) => (
            <span
              key={skill}
              className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
            >
              {skill}
              <button type="button" onClick={() => onRemove(skill)} aria-label={`Remove ${skill}`}>
                <X className="size-3" />
              </button>
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
  )
}

export function SkillsHaveAndNeedForm({
  resumeKeywords,
  initialSkillsHave,
  strongAiSkills,
  initialSkillsNeed,
  targetRole,
  onConfirmed,
}: {
  resumeKeywords: string[]
  initialSkillsHave: string[]
  strongAiSkills: boolean
  initialSkillsNeed: string[]
  targetRole: string | null
  onConfirmed: () => void
}) {
  const [skillsHave, setSkillsHave] = useState<string[]>(() =>
    computeInitialSkillsHave(resumeKeywords, initialSkillsHave, strongAiSkills)
  )
  const [skillsNeed, setSkillsNeed] = useState<string[]>(initialSkillsNeed)
  const [suggestions, setSuggestions] = useState<SkillGapSuggestions | null | undefined>(undefined)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchSkillGapSuggestions().then((result) => {
      if (!cancelled) setSuggestions(result)
    })
    return () => {
      cancelled = true
    }
  }, [])

  function addSkillHave(value: string) {
    if (!skillsHave.some((s) => s.toLowerCase() === value.toLowerCase())) {
      setSkillsHave((prev) => [...prev, value])
    }
  }
  function addSkillNeed(value: string) {
    if (!skillsNeed.some((s) => s.toLowerCase() === value.toLowerCase())) {
      setSkillsNeed((prev) => [...prev, value])
    }
  }

  const suggestionGroups: { key: keyof SkillGapSuggestions; label: string }[] = [
    { key: 'resumeGaps', label: 'Common for your background, not on your resume' },
    { key: 'roleGaps', label: targetRole ? `For ${targetRole}` : 'For your target role' },
    { key: 'modernSkills', label: 'Modern & AI skills' },
  ]
  const hasSuggestions = suggestionGroups.some((g) => (suggestions?.[g.key]?.length ?? 0) > 0)

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const haveFormData = new FormData()
      skillsHave.forEach((s) => haveFormData.append('confirmedSkillsHave', s))
      const needFormData = new FormData()
      skillsNeed.forEach((s) => needFormData.append('skillsToBuild', s))

      const [haveResult, needResult] = await Promise.all([
        confirmSkillsHave(undefined, haveFormData),
        updateSkillsToBuild(undefined, needFormData),
      ])

      if (haveResult?.error || needResult?.error) {
        setError(haveResult?.error ?? needResult?.error ?? 'Something went wrong — try again.')
        return
      }
      onConfirmed()
    })
  }

  return (
    <div className={cn('space-y-8', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <div className="space-y-2">
        <div>
          <Label>Skills you have</Label>
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
        <ChipEditor skills={skillsHave} onAdd={addSkillHave} onRemove={(s) => setSkillsHave((prev) => prev.filter((v) => v !== s))} />
      </div>

      <div className="space-y-2 border-t border-border pt-6">
        <div>
          <Label>Skills you need to build</Label>
          <p className="text-sm text-muted-foreground">
            Skills worth building for your next job — pick from the suggestions below or add your
            own. Feeds your Learning recommendations and Coaching Notes.
          </p>
        </div>
        {suggestions === undefined ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner size={16} />
            Putting together skill suggestions…
          </div>
        ) : (
          <>
            <ChipEditor skills={skillsNeed} onAdd={addSkillNeed} onRemove={(s) => setSkillsNeed((prev) => prev.filter((v) => v !== s))} />
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
                          const alreadyAdded = skillsNeed.some((s) => s.toLowerCase() === item.toLowerCase())
                          return (
                            <button
                              key={item}
                              type="button"
                              disabled={alreadyAdded}
                              onClick={() => addSkillNeed(item)}
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
          </>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button onClick={handleConfirm} disabled={pending}>
        {pending ? 'Confirming…' : 'Confirm'}
      </Button>
    </div>
  )
}
