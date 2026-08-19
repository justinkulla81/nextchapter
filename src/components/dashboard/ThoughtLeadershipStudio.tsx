'use client'

import { useActionState, useEffect, useState } from 'react'
import type { ContentVenue } from '@prisma/client'
import {
  generateIdeasAction,
  draftPostAction,
  generateArticleAction,
} from '@/app/dashboard/marketing-plan/actions'
import { markLinkedInActivity } from '@/app/dashboard/actions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { InlineLoadingState } from '@/components/ui/spinner'
import { PostToLinkedInButton } from '@/components/dashboard/marketing-plan/PostToLinkedInButton'
import { CONTENT_VENUE_LABEL } from '@/lib/constants/content-venues'

export interface PostIdea {
  title: string
  angle: string
}

export type LinkedInState = { configured: boolean; connected: boolean; blockedByConfidentialMode: boolean }

function IdeaCard({
  idea,
  venues,
  linkedin,
}: {
  idea: PostIdea
  venues: ContentVenue[]
  linkedin?: LinkedInState
}) {
  const [draftState, draftAction, drafting] = useActionState(draftPostAction, undefined)
  const [venue, setVenue] = useState<ContentVenue>(venues[0])
  // Drafts start read-only (server-generated text) but need to become
  // editable once they land — the candidate should be able to tweak the
  // suggestion before posting it, same as any other draft on this page.
  // Mirrors the one-time-adoption effect pattern used elsewhere for
  // useActionState results (e.g. SkillsAssessmentForm).
  const [draftText, setDraftText] = useState<string | null>(null)
  useEffect(() => {
    if (draftState?.draft !== undefined) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraftText(draftState.draft)
    }
  }, [draftState])

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

      <form action={draftAction} className="mt-2 space-y-2">
        <input type="hidden" name="title" value={idea.title} />
        <input type="hidden" name="angle" value={idea.angle} />
        <input type="hidden" name="venue" value={venue} />
        <Textarea
          name="reason"
          rows={2}
          placeholder="Optional: why does this one resonate with you? We'll use it to personalize the draft."
          className="text-sm"
        />
        <Button type="submit" variant="outline" size="sm" disabled={drafting} className={drafting ? 'cursor-progress' : ''}>
          {drafting ? 'Drafting…' : `Draft this for ${CONTENT_VENUE_LABEL[venue]}`}
        </Button>
        {drafting && <InlineLoadingState label="Drafting your post…" />}
      </form>
      {draftState?.error && <p className="mt-2 text-sm text-destructive">{draftState.error}</p>}
      {draftText !== null && (
        <div className="mt-3 space-y-2">
          <Textarea value={draftText} onChange={(e) => setDraftText(e.target.value)} rows={8} />
          {venue === 'LINKEDIN' && linkedin?.configured ? (
            // Real direct-post path for LinkedIn — logs a DIRECT_POST
            // LinkedInActivityLog row and awards points itself (see
            // postToLinkedInAction), so the self-report button below would
            // be redundant here specifically.
            <PostToLinkedInButton
              text={draftText}
              connected={linkedin.connected}
              blockedByConfidentialMode={linkedin.blockedByConfidentialMode}
            />
          ) : (
            <form action={markLinkedInActivity}>
              <Button type="submit" size="sm">
                I posted this
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}

function ArticleGenerator() {
  const [state, formAction, pending] = useActionState(generateArticleAction, undefined)

  return (
    <div className="rounded-lg border border-border p-4">
      <p className="font-medium text-foreground">Create Substack Article / White Paper</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Give it a topic or angle — Victoria drafts a full long-form piece grounded in your
        background.
      </p>
      <form action={formAction} className="mt-3 space-y-2">
        <Textarea name="topic" rows={2} placeholder="e.g. What five years of turnarounds taught me about hiring under pressure" />
        <Button type="submit" variant="outline" size="sm" disabled={pending} className={pending ? 'cursor-progress' : ''}>
          {pending ? 'Drafting…' : 'Generate draft'}
        </Button>
        {pending && <InlineLoadingState label="This can take a bit longer — drafting a full long-form piece…" />}
      </form>
      {state?.error && <p className="mt-2 text-sm text-destructive">{state.error}</p>}
      {state?.draft && (
        <div className="mt-3 space-y-2">
          <Textarea defaultValue={state.draft} rows={12} />
        </div>
      )}
    </div>
  )
}

export function ThoughtLeadershipStudio({
  venues,
  linkedin,
}: {
  venues: ContentVenue[]
  linkedin?: LinkedInState
}) {
  const [ideasState, generateAction, generating] = useActionState(generateIdeasAction, undefined)

  return (
    <div className="space-y-4">
      <form action={generateAction}>
        <Button type="submit" disabled={generating} className={generating ? 'cursor-progress' : ''}>
          {generating ? 'Generating…' : 'Generate 5 Ideas Tailored to my background and goals'}
        </Button>
        {generating && <InlineLoadingState label="Generating ideas tailored to your background…" />}
      </form>
      {ideasState?.error && <p className="text-sm text-destructive">{ideasState.error}</p>}

      {ideasState?.ideas && (
        <div className="space-y-3">
          {ideasState.ideas.map((idea, i) => (
            <IdeaCard key={i} idea={idea} venues={venues} linkedin={linkedin} />
          ))}
        </div>
      )}

      {venues.includes('SUBSTACK') && <ArticleGenerator />}
    </div>
  )
}
