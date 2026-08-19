'use client'

import { useActionState, useState } from 'react'
import { generateIdeasAction } from '@/app/dashboard/marketing-plan/actions'
import { markLinkedInActivity } from '@/app/dashboard/actions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { InlineLoadingState } from '@/components/ui/spinner'
import { PostToLinkedInButton } from '@/components/dashboard/marketing-plan/PostToLinkedInButton'
import { IdeaCard, type LinkedInState } from '@/components/dashboard/ThoughtLeadershipStudio'

// Compose-first LinkedIn flow: a blank text box is the primary surface for
// writing your own post, with "Generate ideas" underneath as a secondary
// aid for when you don't know what to write — the inverse of
// ThoughtLeadershipStudio's ideas-first flow, which still covers non-
// LinkedIn venues (Substack, etc.) elsewhere on this page.
export function LinkedInComposer({ linkedin }: { linkedin: LinkedInState }) {
  const [postText, setPostText] = useState('')
  const [ideasState, generateAction, generating] = useActionState(generateIdeasAction, undefined)

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Textarea
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
              <Button type="submit" size="sm" disabled={!postText.trim()}>
                I posted this
              </Button>
            </form>
          )}
        </div>
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <form action={generateAction}>
          <Button
            type="submit"
            variant="outline"
            disabled={generating}
            className={generating ? 'cursor-progress' : ''}
          >
            {generating ? 'Generating…' : 'Generate ideas'}
          </Button>
          {generating && <InlineLoadingState label="Generating ideas tailored to your background…" />}
        </form>
        {ideasState?.error && <p className="text-sm text-destructive">{ideasState.error}</p>}
        {ideasState?.ideas && (
          <div className="space-y-3">
            {ideasState.ideas.map((idea, i) => (
              <IdeaCard key={i} idea={idea} venues={['LINKEDIN']} linkedin={linkedin} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
