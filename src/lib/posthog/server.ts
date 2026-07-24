import 'server-only'
import { PostHog } from 'posthog-node'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

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
  if (client) client.capture({ distinctId, event, properties })

  // Mirror into Postgres so admin can query/segment server-side events —
  // PostHog's API isn't practical to join against our own candidate data.
  prisma.analyticsEvent
    .create({ data: { distinctId, event, properties: (properties ?? {}) as Prisma.InputJsonValue } })
    .catch(() => {})
}
