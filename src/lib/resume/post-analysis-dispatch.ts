import 'server-only'
import { runPostUploadAnalysis } from '@/lib/resume/post-upload-analysis'
import { captureServerEvent } from '@/lib/posthog/server'

type PreviousScores = Parameters<typeof runPostUploadAnalysis>[2]

// The analysis that follows a résumé read (two model calls, the Market Reality refresh, the admin notice, the CRM mirror)
// is not needed to show the next screen. It used to run in the same function invocation that was still serving the
// member through onboarding step 3 (the résumé read runs in after(), on the instance that took the upload). Now it is
// handed to its own invocation, /api/internal/resume-analysis, which answers 202 and does the work behind its own
// response, so nothing in it shares a process with the member's next pages.
//
// If the hand-off cannot be made (no secret, a preview deployment that refuses it, a network error) the analysis runs
// here, as it always did: the admin notice, the CRM mirror and the starting grade must never be lost to the split.

const DISPATCH_TIMEOUT_MS = 8000

function appOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://launchyournextchapter.com').replace(/\/$/, '')
}

export async function dispatchPostUploadAnalysis(profileId: string, resumeId: string, previous: PreviousScores): Promise<void> {
  const started = Date.now()
  const secret = process.env.CRON_SECRET
  let reason = 'no_secret'
  if (secret) {
    try {
      const res = await fetch(`${appOrigin()}/api/internal/resume-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
        body: JSON.stringify({ profileId, resumeId, previous }),
        signal: AbortSignal.timeout(DISPATCH_TIMEOUT_MS),
      })
      if (res.status === 202) {
        captureServerEvent(profileId, 'resume_analysis_dispatched', { resumeId, mode: 'separate', durationMs: Date.now() - started })
        return
      }
      reason = `status_${res.status}`
    } catch (error) {
      reason = error instanceof Error ? error.name : 'error'
    }
  }
  captureServerEvent(profileId, 'resume_analysis_dispatched', { resumeId, mode: 'inline', reason, durationMs: Date.now() - started })
  await runPostUploadAnalysis(profileId, resumeId, previous)
}
