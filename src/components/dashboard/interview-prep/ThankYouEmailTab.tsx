'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { SectionBlock } from '@/components/candidate/Blocks'
import { ChoiceButtons } from '@/components/candidate/ChoiceButtons'
import { requestThankYouEmail } from '@/app/dashboard/interview-prep/actions'
import type { ThankYouEmailInput } from '@/lib/interview-prep/generate-thank-you-email'

const TONES: { value: ThankYouEmailInput['tone']; label: string }[] = [
  { value: 'warm', label: 'Warm' },
  { value: 'professional', label: 'Professional' },
  { value: 'enthusiastic', label: 'Enthusiastic' },
]

interface ThankYouFormState {
  interviewerName: string
  interviewerTitle: string
  companyName: string
  roleTitle: string
  discussionPoints: string
  tone: ThankYouEmailInput['tone']
}

const EMPTY: ThankYouFormState = {
  interviewerName: '',
  interviewerTitle: '',
  companyName: '',
  roleTitle: '',
  discussionPoints: '',
  tone: 'professional',
}

export function ThankYouEmailTab({ hasJobDescription }: { hasJobDescription: boolean }) {
  const [form, setForm] = useState<ThankYouFormState>(EMPTY)
  const [email, setEmail] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  const canSubmit =
    form.interviewerName.trim() && form.companyName.trim() && form.roleTitle.trim() && form.discussionPoints.trim()

  const handleSubmit = () => {
    if (!canSubmit) return
    startTransition(async () => {
      const result = await requestThankYouEmail(form)
      setEmail(result ?? 'Something went wrong — try again.')
    })
  }

  const field = 'max-w-md text-base'
  const label = 'text-base text-ink'
  const missing = !canSubmit
  return (
    <div className={cn('space-y-6', isPending && 'cursor-wait [&_*]:cursor-wait')}>
      <SectionBlock id="thank-you-h" title="Thank-you email" why="A specific note within a day of the interview is remembered. Tell us what you discussed and we draft it in your tone." />
      <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="interviewerName" className={label}>Interviewer name</Label>
          <Input id="interviewerName" className={field} value={form.interviewerName} onChange={(e) => setForm((f) => ({ ...f, interviewerName: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="interviewerTitle" className={label}>Interviewer title</Label>
          <Input id="interviewerTitle" className={field} value={form.interviewerTitle} onChange={(e) => setForm((f) => ({ ...f, interviewerTitle: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="companyName" className={label}>Company</Label>
          <Input id="companyName" className={field} value={form.companyName} onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="roleTitle" className={label}>Role</Label>
          <Input id="roleTitle" className={field} value={form.roleTitle} onChange={(e) => setForm((f) => ({ ...f, roleTitle: e.target.value }))} />
        </div>
      </div>
      <div className="max-w-2xl space-y-1.5">
        <Label htmlFor="discussionPoints" className={label}>What did you discuss?</Label>
        <Textarea
          id="discussionPoints"
          className="text-base"
          value={form.discussionPoints}
          onChange={(e) => setForm((f) => ({ ...f, discussionPoints: e.target.value }))}
          placeholder="A specific project, question or moment from the conversation. The more specific, the better the email."
          rows={3}
        />
      </div>
      <div className="space-y-1.5">
        <p className={label}>Tone</p>
        <ChoiceButtons name="thank-you-tone" label="Tone" options={TONES} value={form.tone} onChange={(v) => setForm((f) => ({ ...f, tone: v as ThankYouEmailInput['tone'] }))} />
      </div>
      <div className="space-y-2">
        <Button type="button" variant="outline" onClick={handleSubmit} disabled={missing || isPending || !hasJobDescription}>
          {isPending ? 'Drafting your email' : 'Draft my thank-you email'}
        </Button>
        {!hasJobDescription ? (
          <p className="text-base text-muted-foreground">Add the job description above first, so the email fits this job.</p>
        ) : missing ? (
          <p className="text-base text-muted-foreground">Fill in the interviewer name, company, role and what you discussed.</p>
        ) : null}
      </div>
      {email && (
        <div className="max-w-2xl space-y-3 rounded-2xl border border-border p-5">
          <p className="text-base whitespace-pre-line text-ink">{email}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(email)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            }}
          >
            {copied ? 'Copied' : 'Copy the email'}
          </Button>
        </div>
      )}
    </div>
  )
}
