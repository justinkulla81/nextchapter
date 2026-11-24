'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { posthog } from '@/lib/posthog/client'
import { draftStrongerBullet, getEvidenceQuestions } from '@/app/dashboard/resume/studio/polish-actions'
import type { BulletResult, QuestionsResult } from '@/app/dashboard/resume/studio/polish-actions'

export interface StrengthenActions {
  getEvidenceQuestions: (input: unknown) => Promise<QuestionsResult>
  draftStrongerBullet: (input: unknown) => Promise<BulletResult>
}

const REAL_ACTIONS: StrengthenActions = { getEvidenceQuestions, draftStrongerBullet }

type Step =
  | { kind: 'closed' }
  | { kind: 'asking' }
  | { kind: 'questions'; questions: { question: string; why: string }[]; answers: string[] }
  | { kind: 'writing'; questions: { question: string; why: string }[]; answers: string[] }
  | { kind: 'result'; questions: { question: string; why: string }[]; answers: string[]; bullet: string; changed: string }

// Makes one bullet stronger with evidence only the person has. It asks two or three questions, writes a bullet from
// the bullet and the answers and nothing else, shows it, and changes the resume only when they choose "Use this bullet".
// With no bullet yet it is how a job gets a new one.
export function BulletStrengthener({
  draftId,
  role,
  bullet,
  otherBullets,
  onUse,
  actions = REAL_ACTIONS,
  openLabel,
}: {
  draftId: string
  role: { roleTitle: string; companyName: string; dateRangeLabel: string }
  /** The bullet to strengthen, or null to write a new one for this job. */
  bullet: string | null
  otherBullets: string[]
  onUse: (bullet: string) => void
  actions?: StrengthenActions
  openLabel?: string
}) {
  const [step, setStep] = useState<Step>({ kind: 'closed' })
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const forNew = !bullet?.trim()
  const base = { draftId, roleTitle: role.roleTitle, companyName: role.companyName, dates: role.dateRangeLabel, bullet: forNew ? null : bullet, otherBullets }

  function open() {
    setError(null)
    setStep({ kind: 'asking' })
    posthog.capture('resume_strengthen_opened', { draftId, forNewBullet: forNew })
    startTransition(async () => {
      const r = await actions.getEvidenceQuestions(base)
      if (!r.ok) {
        setError(r.error)
        setStep({ kind: 'closed' })
        return
      }
      if (r.questions.length === 0) {
        // Already specific: nothing to ask. Offer the wording-only pass.
        setStep({ kind: 'questions', questions: [], answers: [] })
        return
      }
      setStep({ kind: 'questions', questions: r.questions, answers: r.questions.map(() => '') })
    })
  }

  function write(questions: { question: string; why: string }[], answers: string[]) {
    setError(null)
    setStep({ kind: 'writing', questions, answers })
    startTransition(async () => {
      const r = await actions.draftStrongerBullet({ ...base, answers: questions.map((q, i) => ({ question: q.question, answer: answers[i] ?? '' })) })
      if (!r.ok) {
        setError(r.error)
        setStep({ kind: 'questions', questions, answers })
        return
      }
      setStep({ kind: 'result', questions, answers, bullet: r.bullet, changed: r.changed })
    })
  }

  if (step.kind === 'closed') {
    return (
      <div className="space-y-1">
        <Button type="button" size="sm" variant="ghost" onClick={open} aria-label={forNew ? `Add a bullet with help for ${role.roleTitle || 'this job'}` : 'Strengthen this bullet'}>
          {openLabel ?? (forNew ? 'Add a bullet with help' : 'Strengthen this bullet')}
        </Button>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    )
  }

  const busy = pending || step.kind === 'asking' || step.kind === 'writing'
  return (
    <div className={cn('space-y-3 rounded-lg border border-border p-4', busy && 'cursor-progress')} role="group" aria-label={forNew ? 'Add a bullet with help' : 'Strengthen this bullet'}>
      {step.kind === 'asking' && <p className="text-sm text-muted-foreground">Reading your bullet…</p>}

      {(step.kind === 'questions' || step.kind === 'writing') && (
        <>
          <p className="text-sm font-medium text-foreground">{step.questions.length > 0 ? 'Tell us what you know. Only what you add goes into the bullet.' : 'This bullet is already specific. We can tighten the wording without changing any facts.'}</p>
          {step.questions.map((q, i) => (
            <div key={i} className="space-y-1">
              <Label>
                <span className="text-sm text-foreground">{q.question}</span>
                <Input
                  className="mt-1"
                  value={step.answers[i] ?? ''}
                  maxLength={600}
                  disabled={step.kind === 'writing'}
                  onChange={(e) => setStep({ ...step, answers: step.answers.map((a, j) => (j === i ? e.target.value : a)) })}
                />
              </Label>
              <p className="text-xs text-muted-foreground">{q.why}</p>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={busy || (forNew && step.answers.every((a) => !a.trim()))}
              onClick={() => write(step.questions, step.answers)}
            >
              {step.kind === 'writing' ? 'Writing…' : step.answers.some((a) => a.trim()) ? 'Write a stronger bullet' : 'Tighten the wording'}
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setStep({ kind: 'closed' })}>
              Cancel
            </Button>
            {forNew && step.answers.every((a) => !a.trim()) && <span className="text-xs text-muted-foreground">Answer at least one question so there is something to write from.</span>}
          </div>
        </>
      )}

      {step.kind === 'result' && (
        <div className="space-y-3" role="status">
          {!forNew && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Now</p>
              <p className="text-sm text-muted-foreground">{bullet}</p>
            </div>
          )}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Suggested</p>
            <p className="text-sm text-foreground">{step.bullet}</p>
            {step.changed && <p className="text-xs text-muted-foreground">{step.changed}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                posthog.capture('resume_bullet_accepted', { draftId, forNewBullet: forNew, answered: step.answers.filter((a) => a.trim()).length })
                onUse(step.bullet)
                setStep({ kind: 'closed' })
              }}
            >
              Use this bullet
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setStep({ kind: 'questions', questions: step.questions, answers: step.answers })}>
              Change my answers
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                posthog.capture('resume_bullet_skipped', { draftId, forNewBullet: forNew })
                setStep({ kind: 'closed' })
              }}
            >
              Keep what I had
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
