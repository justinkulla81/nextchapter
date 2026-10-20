import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withCronRun } from '@/lib/cron/run'
import { clearDemoData } from '@/lib/demo/seed'
import { captureServerEvent } from '@/lib/posthog/server'

export const maxDuration = 300

// Demo organizations expire after 30 days unless extended. This removes the ones
// that ran out, with everything they created. It only ever touches isDemo rows.
export const GET = withCronRun('demo-expiry', async () => {
  const expired = await prisma.organization.findMany({
    where: { isDemo: true, demoExpiresAt: { lt: new Date() } },
    include: { workspaces: true },
    take: 10,
  })
  let removed = 0
  for (const org of expired) {
    try {
      await clearDemoData(org)
      await prisma.organization.delete({ where: { id: org.id } })
      captureServerEvent('system', 'demo_organization_expired', { organizationId: org.id, slug: org.slug })
      removed += 1
    } catch (error) {
      console.error('demo-expiry failed for', org.id, error)
    }
  }
  return NextResponse.json({ expired: expired.length, removed })
})
