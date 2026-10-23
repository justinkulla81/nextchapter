'use server'

import { prisma } from '@/lib/prisma'
import { verifyClaim } from '@/lib/crm/claim'
import { captureServerEvent } from '@/lib/posthog/server'

export type ClaimBucket = 'working' | 'between_jobs'

/**
 * Logged when someone picks where they are on the claim page: a note on their
 * CRM record and an analytics event, so the follow-up is yours to see. The
 * signature on the link is the only credential, and it is checked here too.
 */
export async function recordClaimStart(personId: string, sig: string, bucket: ClaimBucket): Promise<void> {
  if (!verifyClaim(personId, sig)) return
  if (bucket !== 'working' && bucket !== 'between_jobs') return
  const person = await prisma.crmPerson.findUnique({ where: { id: personId }, select: { id: true, deletedAt: true } })
  if (!person || person.deletedAt) return
  await prisma.crmActivity.upsert({
    where: { type_sourceRef: { type: 'NOTE', sourceRef: `claim-start:${personId}:${bucket}` } },
    create: {
      type: 'NOTE', direction: 'INBOUND', personId, subject: 'Started claiming their NextChapter profile',
      body: bucket === 'working' ? 'Said they are working.' : 'Said they are between jobs.',
      isAutoLogged: true, sourceRef: `claim-start:${personId}:${bucket}`,
    },
    update: {},
  })
  captureServerEvent(personId, 'claim_started', { personId, bucket })
}
