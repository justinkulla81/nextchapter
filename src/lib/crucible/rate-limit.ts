import 'server-only'
import { prisma } from '@/lib/prisma'

// No existing per-IP rate limiter anywhere else in the codebase (Crucible's
// only other volume gate, retryCrucibleChallenge, is per-session + a 24h
// timestamp, not per-IP) — this is the first one, kept intentionally
// simple: a plain count query, not a Serializable transaction. A race
// between two concurrent requests from the same IP can let a couple of
// extra calls through at the exact same instant, which is an acceptable
// cost given the generous cap and that this only guards against scripted
// abuse, not a business-critical limit.
const MAX_AI_GRADED_ATTEMPTS_PER_IP_PER_DAY = 8

export async function checkCrucibleAiRateLimit(ip: string | null): Promise<boolean> {
  // Fail open when we don't have an IP to key off of — better to let a rare
  // untracked request through than to silently block real candidates.
  if (!ip) return true

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const [promptCount, datasetCount] = await Promise.all([
    prisma.crucibleSession.count({ where: { ip, promptScore: { not: null }, startedAt: { gte: since } } }),
    prisma.crucibleSession.count({ where: { ip, datasetScore: { not: null }, startedAt: { gte: since } } }),
  ])
  return promptCount + datasetCount < MAX_AI_GRADED_ATTEMPTS_PER_IP_PER_DAY
}
