'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { generateNarrative, updateCoreStatement } from '@/app/dashboard/interview-prep/actions'
import { WaysToSayIt } from '@/components/dashboard/marketing-plan/WaysToSayIt'
import type { NarrativeAdaptations } from '@/lib/narrative/generate-adaptations'

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? 'Copied' : 'Copy'}
    </Button>
  )
}

export function MyStoryTab({
  coreStatement,
  adaptations,
  linkedin,
}: {
  coreStatement: string | null
  adaptations: NarrativeAdaptations | null
  // Only passed on the Marketing Plan page — Interview Prep (the other
  // renderer of this shared tab) never shows the LinkedIn direct-post
  // button, since posting isn't this page's job.
  linkedin?: { configured: boolean; connected: boolean }
}) {
  const [isPending, startTransition] = useTransition()
  const [draft, setDraft] = useState(coreStatement ?? '')
  const [editing, setEditing] = useState(false)

  const handleGenerate = () => {
    startTransition(async () => {
      await generateNarrative()
    })
  }

  const handleSaveEdit = () => {
    startTransition(async () => {
      await updateCoreStatement(draft)
      setEditing(false)
    })
  }

  return (
    <div className={cn('space-y-6', isPending && 'cursor-wait [&_*]:cursor-wait')}>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Core Narrative Statement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!coreStatement ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                One 2-3 sentence statement of who you are professionally — Victoria drafts it from
                your profile, and everything else on this tab adapts from it.
              </p>
              <Button type="button" onClick={handleGenerate} disabled={isPending}>
                {isPending ? 'Drafting…' : 'Draft my Core Narrative Statement'}
              </Button>
            </div>
          ) : editing ? (
            <div className="space-y-3">
              <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} />
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={handleSaveEdit} disabled={isPending}>
                  {isPending ? 'Saving…' : 'Save & regenerate adaptations'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setDraft(coreStatement)
                    setEditing(false)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-foreground">{coreStatement}</p>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
                  Edit
                </Button>
                <CopyButton text={coreStatement} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {adaptations && <WaysToSayIt adaptations={adaptations} linkedin={linkedin} />}
    </div>
  )
}
