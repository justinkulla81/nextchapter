'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { generateIdeasAction, draftPostAction } from '@/app/dashboard/marketing-plan/actions'
import { markLinkedInActivity } from '@/app/dashboard/actions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { InlineLoadingState } from '@/components/ui/spinner'
import { AvatarDisplay } from '@/components/ui/avatar-display'
import { PostToLinkedInButton } from '@/components/dashboard/marketing-plan/PostToLinkedInButton'
import type { PostIdea, LinkedInState } from '@/components/dashboard/ThoughtLeadershipStudio'

// A single idea in the carousel — lightweight (title, angle, one small
// "Draft this for LinkedIn" button) since drafting doesn't get its own box
// anymore; it populates the one shared compose box below instead.
function IdeaCarouselCard({ idea, onDrafted }: { idea: PostIdea; onDrafted: (text: string) => void }) {
  const [draftState, draftAction, drafting] = useActionState(draftPostAction, undefined)

  useEffect(() => {
    if (draftState?.draft !== undefined) {
      onDrafted(draftState.draft)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftState])

  return (
    <div className="w-64 shrink-0 space-y-2 rounded-lg border border-border p-3">
      <p className="text-sm font-medium text-foreground">{idea.title}</p>
      <p className="line-clamp-3 text-xs text-muted-foreground">{idea.angle}</p>
      <form action={draftAction}>
        <input type="hidden" name="title" value={idea.title} />
        <input type="hidden" name="angle" value={idea.angle} />
        <input type="hidden" name="venue" value="LINKEDIN" />
        {/* Deliberately smaller than the Post button below — this is an
            optional shortcut that fills the box, not the primary action. */}
        <Button
          type="submit"
          size="xs"
          variant="outline"
          disabled={drafting}
          className={drafting ? 'cursor-progress' : ''}
        >
          {drafting ? 'Drafting…' : 'Draft this for LinkedIn'}
        </Button>
      </form>
      {draftState?.error && <p className="text-xs text-destructive">{draftState.error}</p>}
    </div>
  )
}

// Compose-first LinkedIn flow: one shared text box is the primary surface
// for writing your own post, fed either by typing directly or by drafting
// from a generated idea in the carousel above it.
export function LinkedInComposer({
  linkedin,
  name,
  photoUrl,
}: {
  linkedin: LinkedInState
  name: string
  photoUrl?: string | null
}) {
  const [postText, setPostText] = useState('')
  const [ideasState, generateAction, generating] = useActionState(generateIdeasAction, undefined)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setPostText('')
            textareaRef.current?.focus()
          }}
        >
          Post Your Own Thoughts
        </Button>
        <form action={generateAction}>
          <Button type="submit" variant="outline" disabled={generating} className={generating ? 'cursor-progress' : ''}>
            {generating ? 'Generating…' : 'Generate ideas'}
          </Button>
        </form>
      </div>
      {generating && <InlineLoadingState label="Generating ideas tailored to your background…" />}
      {ideasState?.error && <p className="text-sm text-destructive">{ideasState.error}</p>}

      {ideasState?.ideas && ideasState.ideas.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {ideasState.ideas.map((idea, i) => (
            <IdeaCarouselCard key={i} idea={idea} onDrafted={setPostText} />
          ))}
        </div>
      )}

      <div className="flex items-start gap-3">
        {photoUrl && <AvatarDisplay name={name} url={photoUrl} size={40} className="mt-1" />}
        <div className="flex-1 space-y-2">
          <Textarea
            ref={textareaRef}
            value={postText}
            onChange={(e) => setPostText(e.target.value)}
            rows={6}
            placeholder="Write what you want to say on LinkedIn..."
          />
          <div className="flex flex-wrap items-center gap-2">
            {linkedin.configured ? (
              <PostToLinkedInButton
                text={postText}
                connected={linkedin.connected}
                blockedByConfidentialMode={linkedin.blockedByConfidentialMode}
              />
            ) : (
              <form action={markLinkedInActivity}>
                <Button type="submit" size="sm" variant={postText.trim() ? 'success' : 'outline'} disabled={!postText.trim()}>
                  I posted this
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
