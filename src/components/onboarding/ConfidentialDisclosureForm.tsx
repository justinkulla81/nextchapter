'use client'

import { useState, useTransition } from 'react'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ConfidentialDisclosureFormProps {
  coachFirstName: string
  onSubmit: (hasDisclosure: boolean, disclosureText: string) => Promise<void>
}

// Deliberately separate from the standard Coaching Onboarding Form — see
// its own comment forbidding sensitive-topics questions. Coach-only
// visibility (Coaching Notes/Pre-Session Brief), never the Dossier or any
// recruiter/employer-facing surface.
export function ConfidentialDisclosureForm({ coachFirstName, onSubmit }: ConfidentialDisclosureFormProps) {
  const [answer, setAnswer] = useState<'yes' | 'no' | null>(null)
  const [text, setText] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleSubmit() {
    if (answer === null) return
    startTransition(async () => {
      await onSubmit(answer === 'yes', text)
      setSubmitted(true)
    })
  }

  if (submitted) {
    return <p className="text-sm text-muted-foreground">Thanks — this stays between you and {coachFirstName}.</p>
  }

  return (
    <div className={cn('space-y-3 rounded-lg border border-border p-4', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <div>
        <p className="text-sm font-medium text-foreground">One optional, confidential question</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Is there anything about a past departure, a performance issue, or other circumstance you&apos;d want{' '}
          {coachFirstName} to know before working together — a termination for cause, a formal complaint, a
          non-compete, anything like that? This stays between you and your coach; it exists so they can help you
          navigate it, not to judge you.
        </p>
      </div>
      <div className="flex gap-3">
        <Button type="button" variant={answer === 'no' ? 'default' : 'outline'} onClick={() => setAnswer('no')}>
          Nothing to share
        </Button>
        <Button type="button" variant={answer === 'yes' ? 'default' : 'outline'} onClick={() => setAnswer('yes')}>
          Yes, there is something
        </Button>
      </div>
      {answer === 'yes' && (
        <div className="space-y-2">
          <Label htmlFor="disclosureText">Tell your coach what they should know</Label>
          <Textarea id="disclosureText" rows={4} value={text} onChange={(e) => setText(e.target.value)} />
        </div>
      )}
      <Button type="button" onClick={handleSubmit} disabled={pending || answer === null || (answer === 'yes' && !text.trim())}>
        Submit
      </Button>
    </div>
  )
}
