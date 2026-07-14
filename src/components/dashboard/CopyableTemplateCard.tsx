'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function CopyableTemplateCard({
  title,
  description,
  template,
}: {
  title: string
  description?: string
  template: string
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(template)
    setCopied(true)
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
    </div>
  )
}
