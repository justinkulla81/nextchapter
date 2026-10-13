import 'server-only'
import { prisma } from '@/lib/prisma'

// Live-board counts by source x level. The board is ~97k rows and this
// groupBy ran on every Job Board admin page load; the numbers are only
// summary counts, so memoise 5 minutes per instance. Admin actions that
// change a posting's status call invalidateActiveByLevel() so the same
// instance never shows stale counts right after a click.
const TTL_MS = 5 * 60 * 1000
let cache: { at: number; value: ReturnType<typeof load> } | null = null

function load() {
  return prisma.exclusiveJobPosting.groupBy({
    by: ['source', 'level'],
    where: { status: 'approved', archivedAt: null },
    _count: { _all: true },
  })
}

export function getActiveByLevel() {
  if (!cache || Date.now() - cache.at > TTL_MS) {
    const value = load()
    cache = { at: Date.now(), value }
    value.catch(() => {
      if (cache?.value === value) cache = null
    })
  }
  return cache.value
}

export function invalidateActiveByLevel(): void {
  cache = null
}
