'use client'

import { useActionState, useState } from 'react'
import type { ContentVenue } from '@prisma/client'
import { generateIdeasAction, draftPostAction } from '@/app/dashboard/thought-leadership/actions'
import { markLinkedInActivity } from '@/app/dashboard/actions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { CONTENT_VENUE_LABEL } from '@/lib/constants/content-venues'

interface PostIdea {
  title: string
  angle: string
}

function IdeaCard({ idea, venues }: { idea: PostIdea; venues: ContentVenue[] }) {
  const [draftState, draftAction, drafting] = useActionState(draftPostAction, undefined)
  const [venue, setVenue] = useState<ContentVenue>(venues[0])

  return (
    <div className="rounded-lg border border-border p-4">
      <p className="font-medium text-foreground">{idea.title}</p>
      <p className="text-sm text-muted-foreground">{idea.angle}</p>

      {venues.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {venues.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVenue(v)}
              className={
                v === venue
                  ? 'rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground'
                  : 'rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/70'
              }
            >
              {CONTENT_VENUE_LABEL[v]}
            </button>
          ))}
        </div>
      )}

      <form action={draftAction} className="mt-2">
        <input type="hidden" name="title" value={idea.title} />
        <input type="hidden" name="angle" value={idea.angle} />
        <input type="hidden" name="venue" value={venue} />
        <Button type="submit" variant="outline" size="sm" disabled={drafting} className={drafting ? 'cursor-progress' : ''}>
          {drafting ? 'Drafting…' : `Draft this for ${CONTENT_VENUE_LABEL[venue]}`}
        </Button>
      </form>
      {draftState?.error && <p className="mt-2 text-sm text-destructive">{draftState.error}</p>}
      {draftState?.draft && (
        <div className="mt-3 space-y-2">
          <Textarea defaultValue={draftState.draft} rows={8} />
          <form action={markLinkedInActivity}>
            <Button type="submit" size="sm">
              I posted this
            </Button>
          </form>
        </div>
      )}
    </div>
  )
}

export function ThoughtLeadershipStudio({ venues }: { venues: ContentVenue[] }) {
  const [ideasState, generateAction, generating] = useActionState(generateIdeasAction, undefined)

  return (
    <div className="space-y-4">
      <form action={generateAction}>
        <Button type="submit" disabled={generating} className={generating ? 'cursor-progress' : ''}>
          {generating ? 'Generating…' : 'Generate 5 Ideas Tailored to my background and goals'}
        </Button>
      </form>
      {ideasState?.error && <p className="text-sm text-destructive">{ideasState.error}</p>}

      {ideasState?.ideas && (
        <div className="space-y-3">
          {ideasState.ideas.map((idea, i) => (
            <IdeaCard key={i} idea={idea} venues={venues} />
          ))}
        </div>
      )}
    </div>
  )
}
