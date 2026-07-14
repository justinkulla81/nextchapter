'use client'

import { useActionState, useState } from 'react'
import { generateIdeasAction, draftPostAction } from '@/app/dashboard/thought-leadership/actions'
import { markLinkedInActivity } from '@/app/dashboard/actions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface PostIdea {
  title: string
  angle: string
}

export function ThoughtLeadershipStudio() {
  const [ideasState, generateAction, generating] = useActionState(generateIdeasAction, undefined)
  const [draftState, draftAction, drafting] = useActionState(draftPostAction, undefined)
  const [selectedIdea, setSelectedIdea] = useState<PostIdea | null>(null)

  return (
    <div className="space-y-4">
      <form action={generateAction}>
        <Button type="submit" disabled={generating}>
          {generating ? 'Generating…' : 'Generate 5 post ideas'}
        </Button>
      </form>
      {ideasState?.error && <p className="text-sm text-destructive">{ideasState.error}</p>}

      {ideasState?.ideas && (
        <div className="space-y-3">
          {ideasState.ideas.map((idea, i) => (
            <div key={i} className="rounded-lg border border-border p-4">
              <p className="font-medium text-foreground">{idea.title}</p>
              <p className="text-sm text-muted-foreground">{idea.angle}</p>
              <form action={draftAction} className="mt-2">
                <input type="hidden" name="title" value={idea.title} />
                <input type="hidden" name="angle" value={idea.angle} />
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  disabled={drafting}
                  onClick={() => setSelectedIdea(idea)}
                >
                  {drafting && selectedIdea?.title === idea.title ? 'Drafting…' : 'Draft this'}
                </Button>
              </form>
              {draftState?.draft && selectedIdea?.title === idea.title && (
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
          ))}
        </div>
      )}
    </div>
  )
}
