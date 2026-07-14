'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function ProofPointCard({ proofPoint }: { proofPoint: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(proofPoint)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-lg border border-brand/20 bg-brand/5 p-4">
      <h2 className="text-xs font-semibold tracking-widest text-brand uppercase">
        Investor proof point
      </h2>
      <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-foreground">{proofPoint}</pre>
      <Button type="button" size="sm" variant="outline" className="mt-3" onClick={handleCopy}>
        {copied ? 'Copied' : 'Copy to clipboard'}
      </Button>
    </div>
  )
}
