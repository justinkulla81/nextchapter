'use client'

import { useState, useTransition } from 'react'
import {
  updateActiveJobDescription,
  fetchActiveJobDescriptionFromUrl,
} from '@/app/dashboard/interview-prep/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

// A titled section with one reason, and the orange kept for the page's one action.
export function JobDescriptionCard({ initialValue }: { initialValue: string | null }) {
  const [url, setUrl] = useState('')
  const [showPaste, setShowPaste] = useState(!!initialValue)
  const [value, setValue] = useState(initialValue ?? '')
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleUrlContinue = () => {
    if (!url.trim()) return
    startTransition(async () => {
      const result = await fetchActiveJobDescriptionFromUrl(url.trim())
      if (result.success && result.text) {
        setValue(result.text)
        setShowPaste(true)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } else {
        // Smooth, silent fallback — no error shown, per design.
        setShowPaste(true)
      }
    })
  }

  const handleSave = () => {
    startTransition(async () => {
      await updateActiveJobDescription(value)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  return (
    <section aria-labelledby="jd-h" className={cn('space-y-3', isPending && 'cursor-wait [&_*]:cursor-wait')}>
      <div className="space-y-1">
        <h2 id="jd-h" className="font-display text-xl font-semibold text-ink">
          Which job are you preparing for?
        </h2>
        <p className="max-w-2xl text-base text-muted-foreground">
          Your story, answers, practice and thank-you notes are written for this role. Change it any time you prepare for a different interview.
        </p>
      </div>
      {!showPaste ? (
        <div className="flex flex-wrap items-center gap-3">
          <Label htmlFor="jobUrl" className="sr-only">
            Job posting link
          </Label>
          <Input id="jobUrl" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste the job posting link" className="h-10 max-w-sm" />
          <Button type="button" variant="outline" onClick={handleUrlContinue} disabled={isPending || !url.trim()}>
            {isPending ? 'Reading the posting' : 'Use this job'}
          </Button>
          <button type="button" onClick={() => setShowPaste(true)} className="text-sm font-medium text-brand underline underline-offset-4">
            Paste the text instead
          </button>
          {!url.trim() && <p className="basis-full text-sm text-muted-foreground">Paste a link to turn on “Use this job”.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          <Label htmlFor="jobDescription" className="sr-only">
            Job description
          </Label>
          <Textarea id="jobDescription" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Paste the job description here" rows={6} />
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" onClick={handleSave} disabled={isPending || !value.trim()}>
              {isPending ? 'Saving the job' : 'Save this job'}
            </Button>
            {saved && <span className="text-sm font-medium text-ink">Saved</span>}
            {!value.trim() && <span className="text-sm text-muted-foreground">Paste the description to turn on saving.</span>}
          </div>
        </div>
      )}
    </section>
  )
}
