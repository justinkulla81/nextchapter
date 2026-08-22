'use client'

import { useState } from 'react'
import { getCrucibleCandidateResumeSignedUrl } from '@/app/noexperience/employers/(app)/candidates/actions'
import { cn } from '@/lib/utils'

export function CandidateResumeDownloadButton({
  sessionId,
  contestId,
}: {
  sessionId: string
  contestId?: string
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setError(null)
    const result = await getCrucibleCandidateResumeSignedUrl(sessionId, contestId)
    setLoading(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    window.open(result.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className={cn(loading && 'cursor-wait')}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="text-sm font-medium text-primary underline underline-offset-4 disabled:cursor-wait disabled:opacity-60"
      >
        {loading ? 'Preparing…' : 'Download resume'}
      </button>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}
