import 'server-only'
import { randomUUID } from 'node:crypto'
import { after } from 'next/server'
import { PostHog } from 'posthog-node'
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

/**
 * Writes the Postgres copy of a server event as ONE statement. It used to be `prisma.analyticsEvent.create(...)` left
 * running after the response: Prisma wraps a create in BEGIN / INSERT / COMMIT, and when the serverless function froze
 * between the INSERT and the COMMIT the connection stayed "idle in transaction" for minutes (seen 2026-10-26, 4m40s),
 * blocking index builds and holding a pooled connection. A single autocommit INSERT has no such window, and `after()`
 * keeps the function alive until it finishes (outside a request, e.g. a script, it just runs).
 */
export function mirrorServerEvent(distinctId: string, event: string, properties?: Record<string, unknown>) {
  const json = JSON.stringify(properties ?? {})
  const write = prisma
    .$executeRaw`INSERT INTO "AnalyticsEvent" ("id", "distinctId", "event", "properties") VALUES (${randomUUID()}, ${distinctId}, ${event}, ${json}::jsonb)`
    .then(() => undefined)
    .catch(() => undefined)
  try {
    after(() => write)
  } catch {
    // Not inside a request (a script or a test): the write is already running.
  }
}

export function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
) {
  if (client) client.capture({ distinctId, event, properties })

  // Mirror into Postgres so admin can query/segment server-side events —
  // PostHog's API isn't practical to join against our own candidate data.
  mirrorServerEvent(distinctId, event, properties)
}
