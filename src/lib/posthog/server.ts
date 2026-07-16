import 'server-only'
import { PostHog } from 'posthog-node'

const globalForPostHog = globalThis as unknown as { posthogServer?: PostHog }

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST

const client =
  globalForPostHog.posthogServer ??
  (KEY
    ? new PostHog(KEY, { host: HOST, flushAt: 1, flushInterval: 0 })
    : undefined)

if (process.env.NODE_ENV !== 'production' && client) globalForPostHog.posthogServer = client

export function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
) {
  if (!client) return
  client.capture({ distinctId, event, properties })
}
