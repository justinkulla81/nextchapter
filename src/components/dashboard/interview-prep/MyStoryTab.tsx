'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { generateNarrative, updateCoreStatement } from '@/app/dashboard/interview-prep/actions'
import type { NarrativeAdaptations } from '@/lib/narrative/generate-adaptations'

const ADAPTATION_LABELS: Record<keyof NarrativeAdaptations, string> = {
  linkedinHeadline: 'LinkedIn Headline',
  linkedinAbout: 'LinkedIn About',
  resumeSummary: 'Resume Summary',
  emailOpening: 'Email Opening',
  verbal30s: '30-Second Verbal',
  tellMeAboutYourself: '"Tell Me About Yourself"',
}

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
}: {
  coreStatement: string | null
  adaptations: NarrativeAdaptations | null
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
    <div className="space-y-6">
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

      {adaptations && (
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground">
            Six ways to say it
          </h2>
          {(Object.keys(ADAPTATION_LABELS) as (keyof NarrativeAdaptations)[]).map((key) => (
            <Card key={key}>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {ADAPTATION_LABELS[key]}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="whitespace-pre-line text-sm text-foreground">{adaptations[key]}</p>
                <CopyButton text={adaptations[key]} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
