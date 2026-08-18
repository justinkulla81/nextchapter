'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CopyButton } from '@/components/ui/copy-button'
import { PostToLinkedInButton } from '@/components/dashboard/marketing-plan/PostToLinkedInButton'
import type { NarrativeAdaptations } from '@/lib/narrative/generate-adaptations'

interface AdaptationItem {
  key: keyof NarrativeAdaptations
  label: string
  // None of these eight items are genuinely post-worthy as-is — they're
  // phrasing for a resume, cover letter, conversation, or interview answer,
  // not a public status update (LinkedIn About/Headline included: LinkedIn
  // has no API to rewrite a profile field, so "posting" that text would
  // just publish it as an unrelated feed post — see the bug this field
  // used to cause). Kept as an opt-in flag, not deleted outright, in case a
  // future item here genuinely is post-worthy. The real "compose a LinkedIn
  // post" flow lives in ThoughtLeadershipStudio, where drafts are actually
  // written to be posted.
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
      { key: 'linkedinAbout', label: 'LinkedIn About' },
    ],
  },
  {
    question: 'What do I say in an interview?',
    items: [
      { key: 'tellMeAboutYourself', label: '"Tell Me About Yourself"' },
      { key: 'emailOpening', label: 'Email Opening' },
      { key: 'linkedinHeadline', label: 'LinkedIn Headline' },
    ],
  },
]

export function WaysToSayIt({
  adaptations,
  linkedin,
}: {
  adaptations: NarrativeAdaptations
  linkedin?: { configured: boolean; connected: boolean; blockedByConfidentialMode: boolean }
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
                      <PostToLinkedInButton
                        text={adaptations[item.key]}
                        connected={linkedin.connected}
                        blockedByConfidentialMode={linkedin.blockedByConfidentialMode}
                      />
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
