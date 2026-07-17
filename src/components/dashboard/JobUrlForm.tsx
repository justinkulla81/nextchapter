'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import { submitJobUrl } from '@/app/dashboard/find-my-job/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { getBlockedJobHost } from '@/lib/jobs/blocked-job-hosts'
import { cn } from '@/lib/utils'

export function JobUrlForm() {
  const [state, formAction, pending] = useActionState(submitJobUrl, undefined)
  const [url, setUrl] = useState('')
  const blocked = getBlockedJobHost(url)

  return (
    <form
      action={formAction}
      className={cn(
        'space-y-4 rounded-lg border border-border p-4',
        pending && 'cursor-progress [&_*]:cursor-progress'
      )}
    >
      <div className="space-y-2">
        <Label htmlFor="url">Job posting URL</Label>
        <Input
          id="url"
          name="url"
          type="url"
          placeholder="https://"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Works best with company career-site postings and Lever. LinkedIn, Indeed, Glassdoor,
          Greenhouse, and similar sites can&apos;t be fetched automatically — paste the text for
          those instead.
        </p>
      </div>

      {blocked && (
        <div className="space-y-2 rounded-md border border-orange/30 bg-orange/5 p-3">
          <p className="text-sm text-foreground">
            {blocked.name}
            {' '}
            {blocked.reason}, so this can&apos;t be fetched automatically. Paste the job
            description text below and we&apos;ll analyze that instead.
          </p>
          <Textarea name="text" rows={6} placeholder="Paste the full job description text here…" required />
        </div>
      )}

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? 'Analyzing…' : blocked ? 'Analyze pasted text' : 'Add job'}
      </Button>
    </form>
  )
}
