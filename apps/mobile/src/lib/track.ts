import { Platform } from 'react-native'
import { POSTHOG_HOST, POSTHOG_KEY } from '@/lib/config'

// PostHog events from the app, sent straight to the capture endpoint (no SDK). Fire and forget: a failed send never shows.
const deviceId = `app-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`

export function track(event: string, properties: Record<string, unknown> = {}) {
  if (!POSTHOG_KEY) return
  fetch(`${POSTHOG_HOST}/capture/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: POSTHOG_KEY, event, distinct_id: deviceId, properties: { ...properties, platform: Platform.OS, source: 'mobile_app' } }),
  }).catch(() => {})
}
