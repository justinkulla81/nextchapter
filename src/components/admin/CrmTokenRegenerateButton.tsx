'use client'

import { useState, useTransition } from 'react'
import { regenerateCaptureToken } from '@/app/support/admin/(portal)/crm/capture-tokens/actions'

export function CrmTokenRegenerateButton({ tokenId }: { tokenId: string }) {
  const [pending, start] = useTransition()
  const [result, setResult] = useState<{ token?: string; message: string } | null>(null)

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setResult(await regenerateCaptureToken(tokenId)))}
        className={`rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted ${pending ? 'cursor-progress opacity-60' : ''}`}
      >
        Regenerate
      </button>
      {result?.token && (
        <div className="mt-2 rounded-md border border-brand/50 bg-brand/5 p-3">
          <p className="text-sm font-medium">{result.message}</p>
          <code className="mt-2 block break-all rounded bg-background p-2 font-mono text-xs">{result.token}</code>
        </div>
      )}
    </div>
  )
}
