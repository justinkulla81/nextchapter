import 'server-only'
import { prisma } from '@/lib/prisma'

// Card opens per service over the last 30 days (he_service_opened, mirrored
// into AnalyticsEvent by captureServerEvent). Admin previews don't count.
export async function serviceUsage30d(institutionId: string): Promise<Record<string, number>> {
  const rows = await prisma.$queryRaw<{ service: string; n: number }[]>`
    select properties->>'service' as service, count(*)::int as n
    from "AnalyticsEvent"
    where event = 'he_service_opened'
      and "createdAt" >= now() - interval '30 days'
      and properties->>'institutionId' = ${institutionId}
      and coalesce((properties->>'preview')::boolean, false) = false
    group by 1`
  return Object.fromEntries(rows.map((r) => [r.service, r.n]))
}
