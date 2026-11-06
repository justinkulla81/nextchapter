import 'server-only'
import { captureServerEvent } from '@/lib/posthog/server'

// Server render time of an onboarding step's page, as one PostHog event, so a slow step shows up in numbers
// (onboarding_step_rendered: step, serverMs, profileMs). It times the page function itself, not the layout
// above it or the browser's work. Start it at the top of the page and call `done` just before returning.
export function startStepTiming(step: string) {
  const started = Date.now()
  let profileMs: number | null = null
  return {
    /** The profile (auth, role check, sync) was loaded. */
    profileLoaded() {
      profileMs = Date.now() - started
    },
    done(candidateId: string, extra: Record<string, unknown> = {}) {
      captureServerEvent(candidateId, 'onboarding_step_rendered', { candidateId, step, serverMs: Date.now() - started, profileMs, ...extra })
    },
  }
}
