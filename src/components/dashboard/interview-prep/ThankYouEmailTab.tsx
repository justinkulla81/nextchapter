'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { requestThankYouEmail } from '@/app/dashboard/interview-prep/actions'
import type { ThankYouEmailInput } from '@/lib/interview-prep/generate-thank-you-email'

const TONE_LABELS: Record<ThankYouEmailInput['tone'], string> = {
  warm: 'Warm',
  professional: 'Professional',
  enthusiastic: 'Enthusiastic',
}

const EMPTY: ThankYouEmailInput = {
  interviewerName: '',
  interviewerTitle: '',
  companyName: '',
  roleTitle: '',
  discussionPoints: '',
  tone: 'professional',
}

export function ThankYouEmailTab() {
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
      <Card>
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
            <Select
              value={form.tone}
              onValueChange={(v) => setForm((f) => ({ ...f, tone: v as ThankYouEmailInput['tone'] }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a tone">
                  {(value: string | null) =>
                    TONE_LABELS[value as ThankYouEmailInput['tone']] ?? 'Select a tone'
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="warm">Warm</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="enthusiastic">Enthusiastic</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button type="button" onClick={handleSubmit} disabled={!canSubmit || isPending}>
            {isPending ? 'Drafting…' : 'Draft my thank-you email'}
          </Button>
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
