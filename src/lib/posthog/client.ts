'use client'

import type { PostHog } from 'posthog-js'

// A thin stand-in for posthog-js that keeps the real library (~70 KB gzipped) out of every
// page's critical bundle. Calls are queued and replayed, in order, once the library has
// loaded — which is scheduled for browser idle time, not hydration. The only methods the app
// uses are capture / identify / reset, so that is the whole surface here; add to it
// deliberately rather than importing 'posthog-js' directly in a component, which would pull
// the core back into that page's bundle.
const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST

type Properties = Record<string, unknown>

let real: PostHog | null = null
let loading: Promise<PostHog> | null = null
let scheduled = false
const queue: Array<(ph: PostHog) => void> = []

function load(): Promise<PostHog> {
  if (!loading) {
    loading = import('posthog-js').then(({ default: ph }) => {
      ph.init(KEY!, {
        api_host: '/ingest',
        ui_host: HOST,
        person_profiles: 'identified_only',
        capture_pageview: false,
        // Resume text, job descriptions, and interview answers pass through this
        // app — recording is opt-in only, turned on deliberately later if wanted,
        // never a silent default for a site handling this kind of content.
        disable_session_recording: true,
        // PostHog's survey widget (surveys.js, 37 KB) is not used: the app's own forms and prompts do their own capture().
        disable_surveys: true,
      })
      real = ph
      for (const run of queue.splice(0)) run(ph)
      return ph
    })
  }
  return loading
}

// Idle, not immediate: PostHog's own script injections into <head> must never race React's
// hydration pass (that once caused a spurious hydration-mismatch error against unrelated
// server-rendered <script> tags such as the JSON-LD), and analytics should not compete with
// the page for the main thread while it becomes interactive.
function scheduleLoad() {
  if (scheduled || !KEY || typeof window === 'undefined') return
  scheduled = true
  const start = () => void load().catch(() => undefined)
  if ('requestIdleCallback' in window) window.requestIdleCallback(start, { timeout: 3000 })
  else setTimeout(start, 1500)
}

function run(fn: (ph: PostHog) => void) {
  if (!KEY || typeof window === 'undefined') return
  if (real) return fn(real)
  queue.push(fn)
  scheduleLoad()
}

export const posthog = {
  capture(event: string, properties?: Properties) {
    run((ph) => ph.capture(event, properties))
  },
  identify(distinctId: string, properties?: Properties) {
    run((ph) => ph.identify(distinctId, properties))
  },
  reset() {
    run((ph) => ph.reset())
  },
}

// Drop-in for posthog-js/react's usePostHog(): same call shape, always defined.
export function usePostHog() {
  return posthog
}
