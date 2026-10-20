'use client'

import { useState } from 'react'
import { usePostHog } from '@/lib/posthog/client'
import { Button } from '@/components/ui/button'
import { SentItPrompt } from '@/components/dashboard/SentItPrompt'

export function CopyableTemplateCard({
  title,
  description,
  template,
  templateType,
  onCopy,
  outreach = false,
}: {
  title: string
  description?: string
  template: string
  templateType: string
  onCopy?: () => void
  /** A message the member sends to someone: ask "Did you send it?" after a copy (counts toward Candidate+). */
  outreach?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const [copySignal, setCopySignal] = useState(0)
  const posthog = usePostHog()

  async function handleCopy() {
    await navigator.clipboard.writeText(template)
    setCopied(true)
    setCopySignal((n) => n + 1)
    posthog?.capture('email_template_copied', { templateType })
    onCopy?.()
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-2 rounded-lg border border-border p-4">
      <h2 className="text-sm font-medium text-foreground">{title}</h2>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      <pre className="whitespace-pre-wrap rounded bg-muted p-3 text-xs">{template}</pre>
      <Button type="button" size="sm" variant="outline" onClick={handleCopy}>
        {copied ? 'Copied' : 'Copy to clipboard'}
      </Button>
      {outreach && (
        <SentItPrompt
          context={{ source: 'outreach_template', subjectKey: `template:${templateType}`, templateType }}
          note={template}
          copySignal={copySignal}
          reaskOnMount
        />
      )}
    </div>
  )
}
