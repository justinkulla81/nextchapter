'use client'

import { useActionState, useState, useTransition } from 'react'
import type { FormState } from '@/app/support/admin/(portal)/exclusive-jobs/actions'
import { autofillJobPosting, previewJobPostingFit } from '@/app/support/admin/(portal)/exclusive-jobs/actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { ChoiceButtons } from '@/components/onboarding/ChoiceButtons'
import { AUDIENCE_TIER_OPTIONS, DISTRIBUTION_OPTIONS } from '@/lib/jobs/job-board-visibility'
import { getBlockedJobHost } from '@/lib/jobs/blocked-job-hosts'
import { GRADE_TEXT_COLOR, type Grade } from '@/lib/scoring/grade'
import { cn } from '@/lib/utils'

const POSTING_TYPE_OPTIONS = [
  { value: 'direct' as const, label: 'Direct employer posting' },
  { value: 'recruiter_search' as const, label: 'Recruiter-led search' },
]

export function ExclusiveJobPostingForm({
  action,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>
}) {
  const [state, formAction, pending] = useActionState(action, undefined)
  const [postingType, setPostingType] = useState<'direct' | 'recruiter_search' | null>(null)
  const [audienceTier, setAudienceTier] = useState<'ALL_CANDIDATES' | 'A_LIST_ONLY' | null>('A_LIST_ONLY')
  const [distribution, setDistribution] = useState<'OPEN' | 'TARGETED' | null>('OPEN')

  // Autofilled from the URL, then freely editable — the fetch/LLM pass just
  // gives the admin a starting point instead of retyping every field.
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [location, setLocation] = useState('')
  const [salaryMin, setSalaryMin] = useState('')
  const [salaryMax, setSalaryMax] = useState('')
  const [description, setDescription] = useState('')

  const [isAutofilling, startAutofill] = useTransition()
  const [autofillError, setAutofillError] = useState<string | null>(null)
  const [isCheckingFit, startFitCheck] = useTransition()
  const [fit, setFit] = useState<{ matched: number; total: number; grade: Grade } | null>(null)

  const blocked = getBlockedJobHost(url)

  function runFitCheck(nextTitle: string, nextLocation: string, nextSalaryMin: string, nextSalaryMax: string) {
    if (!nextTitle.trim()) return
    startFitCheck(async () => {
      const result = await previewJobPostingFit({
        title: nextTitle,
        location: nextLocation.trim() || null,
        salaryMin: nextSalaryMin ? Number(nextSalaryMin) : null,
        salaryMax: nextSalaryMax ? Number(nextSalaryMax) : null,
      })
      setFit(result)
    })
  }

  function handleAutofill() {
    if (!url.trim() || blocked) return
    setAutofillError(null)
    startAutofill(async () => {
      const result = await autofillJobPosting(url)
      if (result.status === 'error') {
        setAutofillError(result.error)
        return
      }
      const { fields } = result
      if (fields.title) setTitle(fields.title)
      if (fields.companyName) setCompanyName(fields.companyName)
      if (fields.location) setLocation(fields.location)
      if (fields.salaryMin) setSalaryMin(String(fields.salaryMin))
      if (fields.salaryMax) setSalaryMax(String(fields.salaryMax))
      if (fields.description) setDescription(fields.description)
      runFitCheck(
        fields.title ?? title,
        fields.location ?? location,
        fields.salaryMin ? String(fields.salaryMin) : salaryMin,
        fields.salaryMax ? String(fields.salaryMax) : salaryMax
      )
    })
  }

  return (
    <form
      action={formAction}
      className={cn(
        'space-y-4 rounded-lg border border-border p-4',
        pending && 'cursor-progress [&_*]:cursor-progress'
      )}
    >
      <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
        <Label htmlFor="url">Real posting URL</Label>
        <div className="flex gap-2">
          <Input
            id="url"
            name="url"
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://"
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            disabled={isAutofilling || !url.trim() || Boolean(blocked)}
            onClick={handleAutofill}
            className={cn(isAutofilling && 'cursor-progress')}
          >
            {isAutofilling ? 'Fetching…' : 'Autofill from URL'}
          </Button>
        </div>
        {blocked && (
          <p className="text-xs text-muted-foreground">
            {blocked.name} {blocked.reason}, so this can&apos;t be fetched automatically — fill in the
            fields below by hand instead.
          </p>
        )}
        {autofillError && <p className="text-sm text-destructive">{autofillError}</p>}

        {(isCheckingFit || fit) && (
          <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
            {isCheckingFit ? (
              <p className="text-sm text-muted-foreground">Checking candidate fit…</p>
            ) : (
              fit && (
                <>
                  <span className={`text-lg font-bold ${GRADE_TEXT_COLOR[fit.grade]}`}>{fit.grade}</span>
                  <p className="text-sm font-medium text-foreground">
                    Matches {fit.matched} of {fit.total} candidates
                  </p>
                </>
              )
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="title">Job title</Label>
          <Input
            id="title"
            name="title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => runFitCheck(title, location, salaryMin, salaryMax)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="companyName">Company</Label>
          <Input id="companyName" name="companyName" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="location">Location (optional)</Label>
        <Input
          id="location"
          name="location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onBlur={() => runFitCheck(title, location, salaryMin, salaryMax)}
        />
      </div>

      <div className="space-y-2">
        <Label>Direct or recruiter-led?</Label>
        <ChoiceButtons name="postingType" options={POSTING_TYPE_OPTIONS} value={postingType} onChange={setPostingType} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="contactName">Named contact</Label>
          <Input id="contactName" name="contactName" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactEmail">Contact email</Label>
          <Input id="contactEmail" name="contactEmail" type="email" required />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="salaryMin">Salary minimum</Label>
          <Input
            id="salaryMin"
            name="salaryMin"
            type="number"
            required
            min={0}
            value={salaryMin}
            onChange={(e) => setSalaryMin(e.target.value)}
            onBlur={() => runFitCheck(title, location, salaryMin, salaryMax)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="salaryMax">Salary maximum</Label>
          <Input
            id="salaryMax"
            name="salaryMax"
            type="number"
            required
            min={0}
            value={salaryMax}
            onChange={(e) => setSalaryMax(e.target.value)}
            onBlur={() => runFitCheck(title, location, salaryMin, salaryMax)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="salaryCurrency">Currency</Label>
          <Input id="salaryCurrency" name="salaryCurrency" defaultValue="USD" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Note for candidates (optional)</Label>
        <Input
          id="description"
          name="description"
          placeholder="Why this one's worth a look"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-lg border border-border p-4">
        <div className="space-y-2">
          <Label>Who can see this?</Label>
          <ChoiceButtons
            name="audienceTier"
            options={AUDIENCE_TIER_OPTIONS}
            value={audienceTier}
            onChange={setAudienceTier}
          />
        </div>
        <div className="space-y-2">
          <Label>Distribution</Label>
          <ChoiceButtons
            name="distribution"
            options={DISTRIBUTION_OPTIONS}
            value={distribution}
            onChange={setDistribution}
          />
        </div>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <SubmitButton pendingLabel="Adding…">Add exclusive posting</SubmitButton>
    </form>
  )
}
