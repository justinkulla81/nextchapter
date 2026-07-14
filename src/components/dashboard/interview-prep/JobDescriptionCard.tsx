'use client'

import { useState, useTransition } from 'react'
import { updateActiveJobDescription } from '@/app/dashboard/interview-prep/actions'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function JobDescriptionCard({ initialValue }: { initialValue: string | null }) {
  const [value, setValue] = useState(initialValue ?? '')
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleSave = () => {
    startTransition(async () => {
      await updateActiveJobDescription(value)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  return (
    <Card className={cn(isPending && 'cursor-wait [&_*]:cursor-wait')}>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Start here — paste the job description
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Everything below — your story, tough-question answers, practice feedback, thank-you
          emails — gets grounded in the actual role you&apos;re interviewing for. Paste a new one
          any time you&apos;re prepping for a different interview.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="jobDescription" className="sr-only">
            Job description
          </Label>
          <Textarea
            id="jobDescription"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Paste the job description here…"
            rows={6}
          />
        </div>
        <div className="flex items-center gap-3">
          <Button type="button" size="sm" onClick={handleSave} disabled={isPending || !value.trim()}>
            {isPending ? 'Saving…' : 'Save'}
          </Button>
          {saved && <span className="text-xs text-success">Saved</span>}
        </div>
      </CardContent>
    </Card>
  )
}
