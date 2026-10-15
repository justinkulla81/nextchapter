import 'server-only'
import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { getClientIp } from '@/lib/http/client-ip'

// Sliding-window limiter for unauthenticated endpoints that send email, store
// uploads or call a paid API. Backed by RateLimitHit (one row per allowed
// request), keyed by IP or by a hash of the recipient address.
//
// Deliberately simple, like src/lib/crucible/rate-limit.ts: a count then an
// insert, not a serializable transaction. Two simultaneous requests can both
// slip through at the limit; that is fine for scripted-abuse protection.
//
// Fails OPEN on any database error (table not yet created, outage): a broken
// limiter must never stop a real person submitting a form.

const SWEEP_PROBABILITY = 0.02
const RETAIN_MS = 2 * 24 * 60 * 60 * 1000

export const HOUR_MS = 60 * 60 * 1000
export const DAY_MS = 24 * HOUR_MS

export async function allowRequest(opts: {
  bucket: string
  key: string
  limit: number
  windowMs: number
}): Promise<boolean> {
  try {
    const since = new Date(Date.now() - opts.windowMs)
    const used = await prisma.rateLimitHit.count({
      where: { bucket: opts.bucket, key: opts.key, createdAt: { gte: since } },
    })
    if (used >= opts.limit) return false
    await prisma.rateLimitHit.create({ data: { bucket: opts.bucket, key: opts.key } })
    if (Math.random() < SWEEP_PROBABILITY) {
      void prisma.rateLimitHit
        .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - RETAIN_MS) } } })
        .catch(() => {})
    }
    return true
  } catch (error) {
    console.warn('Rate limiter unavailable, allowing request:', error instanceof Error ? error.message : error)
    return true
  }
}

/** Limit by the caller's IP. No IP to key on means allow (never block blind). */
export async function allowByIp(bucket: string, limit: number, windowMs: number): Promise<boolean> {
  const ip = await getClientIp()
  if (!ip) return true
  return allowRequest({ bucket: `ip:${bucket}`, key: ip, limit, windowMs })
}

/** Limit by recipient/subject address, stored as a hash so no raw email lands in this table. */
export async function allowByTarget(bucket: string, value: string, limit: number, windowMs: number): Promise<boolean> {
  const key = createHash('sha256').update(value.trim().toLowerCase()).digest('hex').slice(0, 32)
  return allowRequest({ bucket: `target:${bucket}`, key, limit, windowMs })
}

export const RATE_LIMITED_MESSAGE = 'Too many requests from this network. Please wait a while and try again.'
