'use client'

import { useActionState, useState } from 'react'
import type { PageContent } from '@prisma/client'
import type { FormState } from '@/app/support/admin/(portal)/page-content/actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'

const PAGE_KEYS = [
  'dashboard',
  'network',
  'find-my-job',
  'resume',
  'interview-prep',
  'marketing-plan',
  'learning',
  'linkedin',
  'interim-work',
  'work-samples',
  'community',
  'profile',
  'privacy',
  'portfolio',
  'references',
] as const

function toLocalInputValue(date: Date | null | undefined): string {
  if (!date) return ''
  const d = new Date(date)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export function PageContentForm({
  action,
  existing,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>
  existing?: PageContent
}) {
  const [state, formAction, pending] = useActionState(action, undefined)
  const [boxType, setBoxType] = useState(existing?.boxType ?? 'DAILY_MESSAGE')
  const [videoProvider, setVideoProvider] = useState(existing?.videoProvider ?? '')

  return (
    <form
      action={formAction}
      className={cn(
        'space-y-4 rounded-lg border border-border p-4',
        pending && 'cursor-progress [&_*]:cursor-progress'
      )}
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="pageKey">Page</Label>
          <select
            id="pageKey"
            name="pageKey"
            required
            defaultValue={existing?.pageKey ?? ''}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="" disabled>
              Choose a page…
            </option>
            {PAGE_KEYS.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="boxType">Box</Label>
          <select
            id="boxType"
            name="boxType"
            required
            value={boxType}
            onChange={(e) => setBoxType(e.target.value as typeof boxType)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="DAILY_MESSAGE">Daily Message</option>
            <option value="WHY_IT_MATTERS">Why It Matters</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required defaultValue={existing?.title} placeholder="Short heading" />
      </div>

      {boxType === 'WHY_IT_MATTERS' && (
        <div className="space-y-2">
          <Label htmlFor="leadIn">Why it matters (one sentence)</Label>
          <Input
            id="leadIn"
            name="leadIn"
            defaultValue={existing?.leadIn ?? ''}
            placeholder="e.g. Networking is the single best way to find your next role."
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="bullets">{boxType === 'DAILY_MESSAGE' ? 'Reminders' : 'Pro-tips'} (one per line)</Label>
        <Textarea
          id="bullets"
          name="bullets"
          rows={4}
          defaultValue={existing?.bullets.join('\n') ?? ''}
          placeholder="One idea per line…"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="footer">Closing line (optional)</Label>
        <Input id="footer" name="footer" defaultValue={existing?.footer ?? ''} placeholder="A short closing nudge" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="videoProvider">Video (optional)</Label>
          <select
            id="videoProvider"
            name="videoProvider"
            value={videoProvider}
            onChange={(e) => setVideoProvider(e.target.value as typeof videoProvider)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">None</option>
            <option value="NC_HOSTED">NC-hosted</option>
            <option value="YOUTUBE">YouTube</option>
            <option value="OTHER">Other (Instagram/TikTok/etc)</option>
          </select>
        </div>
        <div className="col-span-2 space-y-2">
          <Label htmlFor="videoUrl">Video URL</Label>
          <Input id="videoUrl" name="videoUrl" defaultValue={existing?.videoUrl ?? ''} placeholder="https://…" />
        </div>
      </div>
      {videoProvider === 'OTHER' && (
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" name="useInlineEmbed" defaultChecked={existing?.useInlineEmbed} />
          Load inline (only works if the URL is itself an embeddable iframe URL — otherwise this shows as a
          link-out card)
        </label>
      )}

      <div className="grid grid-cols-3 gap-4">
        {boxType === 'DAILY_MESSAGE' && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isPinned" defaultChecked={existing?.isPinned} />
            Pinned (always shows first)
          </label>
        )}
        <div className="space-y-2">
          <Label htmlFor="sequenceOrder">Sequence order</Label>
          <Input
            id="sequenceOrder"
            name="sequenceOrder"
            type="number"
            defaultValue={existing?.sequenceOrder ?? ''}
            placeholder="Optional"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="publishAt">Publish at (optional)</Label>
          <Input
            id="publishAt"
            name="publishAt"
            type="datetime-local"
            defaultValue={toLocalInputValue(existing?.publishAt)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expiresAt">Expires at (optional)</Label>
          <Input
            id="expiresAt"
            name="expiresAt"
            type="datetime-local"
            defaultValue={toLocalInputValue(existing?.expiresAt)}
          />
        </div>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <SubmitButton pendingLabel={existing ? 'Saving…' : 'Adding…'}>
        {existing ? 'Save changes' : 'Add content'}
      </SubmitButton>
    </form>
  )
}
