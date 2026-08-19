'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

// Shared "Copy" button — click to copy `text` to the clipboard, briefly
// confirming with "Copied". Extracted from several near-identical inline
// definitions (MyStoryTab, WaysToSayIt, NarrativeManager) that had
// copy-pasted this exact implementation.
export function CopyButton({ text }: { text: string }) {
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
