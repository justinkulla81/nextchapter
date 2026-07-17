'use client'

import { useActionState } from 'react'
import {
  submitSubstackNo,
  submitSubstackUrl,
} from '@/app/dashboard/thought-leadership/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SubmitButton } from '@/components/ui/submit-button'
import { Card, CardContent } from '@/components/ui/card'

interface SubstackCritique {
  relevanceToBackground: string
  noveltyOfIdeas: string
  cadence: string
  overallAssessment: string
}

export function SubstackSection({
  hasAccount,
  url,
  critique,
}: {
  hasAccount: boolean | null
  url: string | null
  critique: SubstackCritique | null
}) {
  const [urlState, urlAction] = useActionState(submitSubstackUrl, undefined)

  if (hasAccount === null) {
    return (
      <Card>
        <CardContent className="space-y-3 pt-6">
          <p className="font-medium text-foreground">Do you have a Substack?</p>
          <div className="flex flex-wrap gap-2">
            <form action={urlAction} className="flex flex-1 gap-2">
              <Input name="url" type="url" placeholder="Paste your Substack URL" className="flex-1" />
              <SubmitButton variant="outline" pendingLabel="Analyzing…">
                Yes
              </SubmitButton>
            </form>
            <form action={submitSubstackNo}>
              <SubmitButton variant="ghost">No</SubmitButton>
            </form>
          </div>
          {urlState?.error && <p className="text-sm text-destructive">{urlState.error}</p>}
        </CardContent>
      </Card>
    )
  }

  if (hasAccount === false) {
    return (
      <Card>
        <CardContent className="space-y-2 pt-6">
          <p className="font-medium text-foreground">Starting a Substack</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Pick a narrow angle tied to your real expertise — not generic career advice.</li>
            <li>Commit to a cadence you can actually sustain (biweekly beats a dead weekly promise).</li>
            <li>Draft your first 3 posts before you announce it publicly.</li>
            <li>Write from your own experience and stories, not secondhand takes.</li>
          </ul>
          <Button nativeButton={false} size="sm" variant="outline" className="mt-2" render={<a href="https://on.substack.com/" target="_blank" rel="noopener noreferrer" />}>
            Substack&apos;s Getting Started guide →
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium text-foreground">Your Substack</p>
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline underline-offset-4">
              View →
            </a>
          )}
        </div>
        {critique ? (
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-medium text-foreground">Relevance to your background</p>
              <p className="text-muted-foreground">{critique.relevanceToBackground}</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Novelty of ideas</p>
              <p className="text-muted-foreground">{critique.noveltyOfIdeas}</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Cadence</p>
              <p className="text-muted-foreground">{critique.cadence}</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Overall</p>
              <p className="text-muted-foreground">{critique.overallAssessment}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Analyzing your Substack…</p>
        )}
        <form action={urlAction} className="flex gap-2 border-t border-border pt-3">
          <Input name="url" type="url" placeholder="Re-check with a different URL" className="flex-1" defaultValue={url ?? ''} />
          <SubmitButton variant="outline" size="sm" pendingLabel="Re-analyzing…">
            Re-analyze
          </SubmitButton>
        </form>
        {urlState?.error && <p className="text-sm text-destructive">{urlState.error}</p>}
      </CardContent>
    </Card>
  )
}
