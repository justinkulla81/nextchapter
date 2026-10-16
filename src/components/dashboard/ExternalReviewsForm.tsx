'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { addExternalReviews } from '@/app/dashboard/work-samples/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { REVIEW_PLATFORMS } from '@/lib/evidence/external-reviews'
import { cn } from '@/lib/utils'

// Review stats from another platform. Inputs are kept on error (React 19
// resets uncontrolled form fields after an action, so they're controlled).
export function ExternalReviewsForm() {
  const [state, formAction, pending] = useActionState(addExternalReviews, undefined)
  const [platform, setPlatform] = useState('upwork')
  const [fields, setFields] = useState({ platformLabel: '', profileUrl: '', rating: '', reviewCount: '', jobsCompleted: '' })
  const set = (k: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement>) => setFields((f) => ({ ...f, [k]: e.target.value }))
  // Clear the form after a successful save (no error came back).
  const wasPending = useRef(false)
  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      setFields({ platformLabel: '', profileUrl: '', rating: '', reviewCount: '', jobsCompleted: '' })
    }
    wasPending.current = pending
  }, [pending, state])
  const label = REVIEW_PLATFORMS.find((p) => p.key === platform)?.label ?? 'the platform'

  return (
    <form action={formAction} className={cn('space-y-4 rounded-lg border border-border p-4', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="platform">Platform</Label>
          <Select name="platform" value={platform} onValueChange={(v) => setPlatform(v ?? 'upwork')}>
            <SelectTrigger id="platform" className="w-full">
              <SelectValue>{(value: string | null) => REVIEW_PLATFORMS.find((p) => p.key === value)?.label ?? 'Choose one'}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {REVIEW_PLATFORMS.map((p) => (
                <SelectItem key={p.key} value={p.key}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {platform === 'other' && (
          <div className="space-y-2">
            <Label htmlFor="platformLabel">Platform name</Label>
            <Input id="platformLabel" name="platformLabel" value={fields.platformLabel} onChange={set('platformLabel')} required />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="profileUrl">Link to your public {platform === 'other' ? 'profile' : `${label} profile`}</Label>
        <Input id="profileUrl" name="profileUrl" type="url" placeholder="https://" value={fields.profileUrl} onChange={set('profileUrl')} required />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="rating">Average rating</Label>
          <Input id="rating" name="rating" inputMode="decimal" placeholder="4.9" value={fields.rating} onChange={set('rating')} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reviewCount">Reviews</Label>
          <Input id="reviewCount" name="reviewCount" inputMode="numeric" placeholder="23" value={fields.reviewCount} onChange={set('reviewCount')} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="jobsCompleted">Jobs done (optional)</Label>
          <Input id="jobsCompleted" name="jobsCompleted" inputMode="numeric" value={fields.jobsCompleted} onChange={set('jobsCompleted')} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="screenshot">Screenshot of your stats (optional, image up to 5MB)</Label>
        <Input id="screenshot" name="screenshot" type="file" accept="image/*" />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Add my reviews'}
      </Button>
      <p className="text-xs text-muted-foreground">
        They count right away, marked &quot;self-reported with link&quot;. Where the platform allows it, we check your public page once to
        confirm your name and numbers. We never log in to a platform for you.
      </p>
    </form>
  )
}
