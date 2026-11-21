// The demo walkthrough of a college check-in: which sample alum it is for. Only a curated or staff-built demo (openDemo),
// and only that demo's own sample member.

import 'server-only'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { openDemo } from './open-demo'
import { demoAlumMember } from './demo-alumni'
import { DEMO_ALUM_COOKIE } from './demo-alumni-shared'

// The alum key comes from the link (the demo bar's choice): check-in pages live on the main site, where the portal
// host's cookie isn't sent. It only ever picks among this demo's own sample alumni.
export async function demoCheckInMember(slug: string, alumKey?: string | null): Promise<{ institutionId: string; memberId: string; firstName: string | null } | null> {
  const inst = await openDemo(slug)
  if (!inst || inst.orgType !== 'COLLEGE') return null
  const chosen = await demoAlumMember(prisma, { id: inst.id, slug }, alumKey ?? (await cookies()).get(DEMO_ALUM_COOKIE)?.value)
  const m = await prisma.institutionMember.findFirst({
    where: { id: chosen ?? `${slug}_member_featured`, institutionId: inst.id, isSampleData: true },
    select: { id: true, firstName: true },
  })
  return m ? { institutionId: inst.id, memberId: m.id, firstName: m.firstName } : null
}
