'use client'

import { useActionState } from 'react'
import { addCuratedVideoAction } from '@/app/support/admin/(portal)/webinars/actions'
import { Input } from '@/components/ui/input'
import { SubmitButton } from '@/components/ui/submit-button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const CATEGORY_LABELS: Record<string, string> = {
  GENERAL: 'General (Videos/Shorts carousels)',
  AI_TOOLS: 'Tools for You (AI tool demos)',
  LINKEDIN_TIPS: 'LinkedIn Tips',
  MOTIVATIONAL: 'Motivational (Check In carousel)',
}

// One form covers both Videos and Shorts — format (LONG_FORM vs. SHORT) is
// derived automatically from the fetched duration (see
// src/lib/content/youtube-ingest.ts's formatFromDuration), so the admin
// never has to pick it. Category defaults to General — pick a different one
// here instead of the old workaround (add as General, then re-tag directly
// in the database).
export function CuratedVideoAddForm({ youtubeConfigured }: { youtubeConfigured: boolean }) {
  const [state, formAction] = useActionState(addCuratedVideoAction, undefined)

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-border p-4">
      <p className="text-sm font-medium text-foreground">Add a video or Short</p>
      <div className="space-y-1">
        <label htmlFor="videoIdOrUrl" className="text-xs font-medium text-muted-foreground">
          YouTube URL or video ID
        </label>
        <Input
          id="videoIdOrUrl"
          name="videoIdOrUrl"
          placeholder="https://www.youtube.com/watch?v=... or the 11-character video ID"
          required
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="category" className="text-xs font-medium text-muted-foreground">
          Category
        </label>
        <Select name="category" defaultValue="GENERAL">
          <SelectTrigger id="category">
            <SelectValue>{(v: string | null) => (v ? CATEGORY_LABELS[v] : undefined)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {!youtubeConfigured && (
        <>
          <p className="text-xs text-muted-foreground">
            YOUTUBE_API_KEY isn&apos;t configured yet, so title/thumbnail can&apos;t be fetched
            automatically — enter them below. This is filed as Video (long-form) by default since
            there&apos;s no duration signal without the API; remove and re-add once the key lands
            if this one&apos;s actually a Short.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="title" className="text-xs font-medium text-muted-foreground">
                Title
              </label>
              <Input id="title" name="title" />
            </div>
            <div className="space-y-1">
              <label htmlFor="thumbnailUrl" className="text-xs font-medium text-muted-foreground">
                Thumbnail URL
              </label>
              <Input id="thumbnailUrl" name="thumbnailUrl" />
            </div>
          </div>
        </>
      )}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">
          Personalization tags (optional) — matching either dimension boosts this video to the top
          of a candidate&apos;s Career and Interview Advice carousel.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <label htmlFor="videoIndustry" className="text-xs font-medium text-muted-foreground">
              Industry
            </label>
            <Input id="videoIndustry" name="videoIndustry" placeholder="e.g. Healthcare" />
          </div>
          <div className="space-y-1">
            <label htmlFor="videoFunction" className="text-xs font-medium text-muted-foreground">
              Function
            </label>
            <Input id="videoFunction" name="videoFunction" placeholder="e.g. Finance" />
          </div>
          <div className="space-y-1">
            <label htmlFor="videoSkill" className="text-xs font-medium text-muted-foreground">
              Skill
            </label>
            <Input id="videoSkill" name="videoSkill" placeholder="e.g. Salary Negotiation" />
          </div>
        </div>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton pendingLabel="Adding…">Add video</SubmitButton>
    </form>
  )
}
