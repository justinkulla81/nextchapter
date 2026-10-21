'use client'

import { useState } from 'react'
import { usePostHog } from '@/lib/posthog/client'
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
    <div className="space-y-3 rounded-2xl border border-border p-5">
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      <pre className="font-sans whitespace-pre-wrap rounded-xl bg-muted/60 p-4 text-sm text-ink">{template}</pre>
      <button type="button" onClick={handleCopy} className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted">
        {copied ? 'Copied' : 'Copy to clipboard'}
      </button>
      {outreach && (
        <SentItPrompt
          context={{ source: 'outreach_template', subjectKey: `template:${templateType}`, templateType }}
          note={template}
          copySignal={copySignal}
          reaskOnMount
          redesign
        />
      )}
    </div>
  )
}
