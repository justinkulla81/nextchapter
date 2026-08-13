'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { postToLinkedInAction } from '@/app/dashboard/marketing-plan/actions'
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

// Posts the given text as a real LinkedIn feed update via the UGC Posts API
// (see src/lib/linkedin/oauth.ts) — the only thing the w_member_social scope
// actually allows (LinkedIn has no API to directly rewrite a profile's
// About/Headline fields), so "Post to LinkedIn" here means publishing that
// text as a status update, not editing the profile field itself.
function PostToLinkedInButton({ text, connected }: { text: string; connected: boolean }) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<'idle' | 'posted' | 'error'>('idle')

  if (!connected) {
    return (
      <a
        href="/api/auth/linkedin/start"
        className={cn(
          'inline-flex h-8 items-center rounded-md border border-input bg-white px-3 text-sm font-medium text-foreground transition-colors hover:border-brand/40'
        )}
      >
        Connect LinkedIn to post
      </a>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isPending}
        className={isPending ? 'cursor-wait' : ''}
        onClick={() => {
          startTransition(async () => {
            const ok = await postToLinkedInAction(text)
            setResult(ok ? 'posted' : 'error')
            setTimeout(() => setResult('idle'), 3000)
          })
        }}
      >
        {isPending ? 'Posting…' : 'Post to LinkedIn'}
      </Button>
      {result === 'posted' && <span className="text-xs font-medium text-success">Posted!</span>}
      {result === 'error' && <span className="text-xs font-medium text-destructive">Couldn&apos;t post — try again</span>}
    </div>
  )
}

interface AdaptationItem {
  key: keyof NarrativeAdaptations
  label: string
  // Only LinkedIn Headline/About are real LinkedIn surfaces — the direct-post
  // button only makes sense next to those two.
  showLinkedInPost?: boolean
}

interface AdaptationGroup {
  question: string
  items: AdaptationItem[]
}

// Four audience-grouped sections, applied identically to the Core Narrative
// and every Tailored Narrative — see marketing-plan redesign spec §6.
// First-person question framing per group, matching how a candidate would
// actually ask themselves "what do I say here?"
const GROUPS: AdaptationGroup[] = [
  {
    question: 'What do I say to friends and family?',
    items: [{ key: 'friendsAndFamily', label: 'For Friends & Family' }],
  },
  {
    question: "What do I say when I'm networking?",
    items: [
      { key: 'verbal30s', label: 'Elevator Pitch' },
      { key: 'conversationOpener', label: 'Conversation Opener' },
    ],
  },
  {
    question: 'What do I put on my resume, LinkedIn, and cover letter?',
    items: [
      { key: 'resumeSummary', label: 'Resume Summary' },
      { key: 'coverLetterTemplate', label: 'Cover Letter' },
      { key: 'linkedinAbout', label: 'LinkedIn About', showLinkedInPost: true },
    ],
  },
  {
    question: 'What do I say in an interview?',
    items: [
      { key: 'tellMeAboutYourself', label: '"Tell Me About Yourself"' },
      { key: 'emailOpening', label: 'Email Opening' },
      { key: 'linkedinHeadline', label: 'LinkedIn Headline', showLinkedInPost: true },
    ],
  },
]

export function WaysToSayIt({
  adaptations,
  linkedin,
}: {
  adaptations: NarrativeAdaptations
  linkedin?: { configured: boolean; connected: boolean }
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-sm font-medium text-muted-foreground">Ways to say it</h2>
      {GROUPS.map((group) => (
        <div key={group.question} className="space-y-3">
          <h3 className="text-base font-semibold text-foreground">{group.question}</h3>
          <div className="space-y-3">
            {group.items.map((item) => (
              <Card key={item.key}>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">{item.label}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="whitespace-pre-line text-sm text-foreground">{adaptations[item.key]}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <CopyButton text={adaptations[item.key]} />
                    {item.showLinkedInPost && linkedin?.configured && (
                      <PostToLinkedInButton text={adaptations[item.key]} connected={linkedin.connected} />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
