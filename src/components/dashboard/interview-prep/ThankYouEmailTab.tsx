'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { requestThankYouEmail } from '@/app/dashboard/interview-prep/actions'
import type { ThankYouEmailInput } from '@/lib/interview-prep/generate-thank-you-email'

const TONES: { value: ThankYouEmailInput['tone']; label: string }[] = [
  { value: 'warm', label: 'Warm' },
  { value: 'professional', label: 'Professional' },
  { value: 'enthusiastic', label: 'Enthusiastic' },
]

const EMPTY: ThankYouEmailInput = {
  interviewerName: '',
  interviewerTitle: '',
  companyName: '',
  roleTitle: '',
  discussionPoints: '',
  tone: 'professional',
}

export function ThankYouEmailTab({ hasJobDescription }: { hasJobDescription: boolean }) {
  const [form, setForm] = useState<ThankYouEmailInput>(EMPTY)
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

  return (
    <div className="space-y-6">
      <Card className={cn(isPending && 'cursor-wait [&_*]:cursor-wait')}>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="interviewerName">Interviewer name</Label>
              <Input
                id="interviewerName"
                value={form.interviewerName}
                onChange={(e) => setForm((f) => ({ ...f, interviewerName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="interviewerTitle">Interviewer title</Label>
              <Input
                id="interviewerTitle"
                value={form.interviewerTitle}
                onChange={(e) => setForm((f) => ({ ...f, interviewerTitle: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="companyName">Company</Label>
              <Input
                id="companyName"
                value={form.companyName}
                onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="roleTitle">Role</Label>
              <Input
                id="roleTitle"
                value={form.roleTitle}
                onChange={(e) => setForm((f) => ({ ...f, roleTitle: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="discussionPoints">What did you discuss?</Label>
            <Textarea
              id="discussionPoints"
              value={form.discussionPoints}
              onChange={(e) => setForm((f) => ({ ...f, discussionPoints: e.target.value }))}
              placeholder="A specific project, question, or moment from the conversation — the more specific, the better the email."
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tone</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {TONES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, tone: t.value }))}
                  aria-pressed={form.tone === t.value}
                  className={cn(
                    'rounded-lg border-2 p-2 text-center text-sm font-medium transition-colors',
                    form.tone === t.value
                      ? 'border-brand bg-brand/5 text-brand'
                      : 'border-border bg-white text-foreground hover:border-brand/40'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <Button type="button" onClick={handleSubmit} disabled={!canSubmit || isPending || !hasJobDescription}>
            {isPending ? 'Drafting…' : 'Draft my thank-you email'}
          </Button>
          {!hasJobDescription && (
            <p className="text-xs text-muted-foreground">Add the job description above first.</p>
          )}
        </CardContent>
      </Card>

      {email && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <p className="whitespace-pre-line text-sm text-foreground">{email}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(email)
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
