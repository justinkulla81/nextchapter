'use client'

import { useState, useTransition } from 'react'
import type { AdminNudgeType } from '@prisma/client'
import { generateNudgeDraft, sendCandidateNudgeEmail } from '@/app/support/admin/(portal)/candidates/[id]/actions'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Duplicated from src/lib/admin/nudge-content.ts (which is `server-only`
// and can't be imported here) — same pattern as PageContentForm's local
// PAGE_KEYS copy.
const NUDGE_TYPE_OPTIONS: { value: AdminNudgeType; label: string }[] = [
  { value: 'WEEKLY_TARGET', label: 'Complete weekly target' },
  { value: 'NETWORKING', label: 'Network more' },
  { value: 'LEARNING', label: 'Learn a new skill' },
  { value: 'INTERIM_JOB', label: 'Find an interim job' },
  { value: 'CONNECT_GMAIL', label: 'Connect Gmail' },
  { value: 'UPDATE_PROFILE', label: 'Update profile' },
  { value: 'COMMUNITY', label: 'Engage in NC Support Network' },
  { value: 'RECRUITER_HELP', label: 'Consider recruiter/coach help' },
  { value: 'UPDATE_PRIVACY', label: 'Review privacy settings' },
]

export function CandidateNudgeEmailPanel({ candidateId }: { candidateId: string }) {
  const [nudgeType, setNudgeType] = useState<AdminNudgeType>('WEEKLY_TARGET')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [cta, setCta] = useState<{ label: string; url: string } | null>(null)
  const [status, setStatus] = useState<'idle' | 'generating' | 'sending' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleGenerate() {
    setStatus('generating')
    setMessage(null)
    startTransition(async () => {
      const result = await generateNudgeDraft(candidateId, nudgeType)
      if ('error' in result) {
        setStatus('error')
        setMessage(result.error)
        return
      }
      setSubject(result.draft.subject)
      setBody(result.draft.body)
      setCta({ label: result.draft.ctaLabel, url: result.draft.ctaUrl })
      setStatus('idle')
    })
  }

  function handleSend() {
    if (!cta) return
    setStatus('sending')
    setMessage(null)
    startTransition(async () => {
      const result = await sendCandidateNudgeEmail(candidateId, nudgeType, subject, body, cta.label, cta.url)
      if (result?.error) {
        setStatus('error')
        setMessage(result.error)
        return
      }
      setStatus('sent')
      setMessage('Email sent.')
    })
  }

  return (
    <div className={cn('space-y-4', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="nudgeType">Nudge</Label>
          <select
            id="nudgeType"
            value={nudgeType}
            onChange={(e) => {
              setNudgeType(e.target.value as AdminNudgeType)
              setSubject('')
              setBody('')
              setCta(null)
              setStatus('idle')
              setMessage(null)
            }}
            className="h-9 min-w-[240px] rounded-md border border-input bg-background px-3 text-sm"
          >
            {NUDGE_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <Button type="button" variant="outline" onClick={handleGenerate} disabled={pending}>
          {status === 'generating' ? 'Generating…' : 'Generate draft'}
        </Button>
      </div>

      {(subject || body) && (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="space-y-2">
            <Label htmlFor="nudgeSubject">Subject</Label>
            <Input id="nudgeSubject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nudgeBody">Body — fully editable before sending</Label>
            <Textarea id="nudgeBody" rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          {cta && (
            <p className="text-xs text-muted-foreground">
              Button in email: &ldquo;{cta.label} →&rdquo; linking to {cta.url}
            </p>
          )}
          <Button type="button" onClick={handleSend} disabled={pending || !subject || !body}>
            {status === 'sending' ? 'Sending…' : 'Send email'}
          </Button>
        </div>
      )}

      {message && (
        <p className={cn('text-sm', status === 'error' ? 'text-destructive' : 'text-success')}>{message}</p>
      )}
    </div>
  )
}
