// Fill a curated demo college that has no people yet (a placeholder row): the same reset the nightly job runs, once, under a
// transaction-scoped advisory lock so two callers (the cron and a first visitor on the public demo link) never fill at once.

import 'server-only'
import { prisma } from '@/lib/prisma'
import { DEMO_TENANTS } from './demo-tenants'
import { resetDemoInstitution } from './demo-seed'
import { seedDemoContent } from '@/lib/institution/admin'
import { captureServerEvent } from '@/lib/posthog/server'

export async function fillDemoIfEmpty(slug: string, source: 'nightly_placeholder' | 'public_link'): Promise<boolean> {
  const tenant = DEMO_TENANTS[slug]
  if (!tenant) return false
  const empty = await prisma.institution.findFirst({ where: { slug, isDemo: true, isSampleData: true, members: { none: {} } }, select: { id: true } })
  if (!empty) return false
  const result = await prisma.$transaction(
    async (tx) => {
      const [lock] = await tx.$queryRaw<{ ok: boolean }[]>`select pg_try_advisory_xact_lock(hashtext(${`demo-fill:${slug}`})) as ok`
      if (!lock?.ok) return null
      // Re-check inside the lock: another caller may have just filled it.
      const still = await tx.institution.findFirst({ where: { slug, isDemo: true, isSampleData: true, members: { none: {} } }, select: { id: true } })
      if (!still) return null
      return resetDemoInstitution(tx, new Date(), tenant)
    },
    { timeout: 120_000, maxWait: 20_000 },
  )
  if (!result) return false
  await seedDemoContent(result.institutionId, 'demo-placeholder')
  captureServerEvent('cron', 'institution_demo_reset', { institutionId: result.institutionId, slug, members: result.members, source })
  return true
}
