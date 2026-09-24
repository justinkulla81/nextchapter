import 'server-only'
import { prisma } from '@/lib/prisma'
import { refreshTouchFields } from '@/lib/crm/sync'

/**
 * Merges one person record into another and soft-deletes the source.
 *
 * Several relations carry a unique constraint that includes personId
 * (affiliation × org × title, research authorship × item, segment and
 * broadcast membership) — repointing the source's rows straight at the
 * target would violate those wherever the target already has a matching
 * row, so each of those tables drops the source's duplicate first. Everything
 * else reassigns directly since no personId-scoped uniqueness applies to it.
 */
export async function mergePersonRecords(sourceId: string, targetId: string): Promise<{ sourceName: string; targetName: string }> {
  const [source, target] = await Promise.all([
    prisma.crmPerson.findUniqueOrThrow({ where: { id: sourceId } }),
    prisma.crmPerson.findUniqueOrThrow({ where: { id: targetId } }),
  ])

  await prisma.$transaction(async (tx) => {
    const targetAffiliations = await tx.crmAffiliation.findMany({ where: { personId: targetId }, select: { orgId: true, title: true } })
    for (const a of targetAffiliations) {
      await tx.crmAffiliation.deleteMany({ where: { personId: sourceId, orgId: a.orgId, title: a.title } })
    }
    await tx.crmAffiliation.updateMany({ where: { personId: sourceId }, data: { personId: targetId } })

    await tx.crmActivity.updateMany({ where: { personId: sourceId }, data: { personId: targetId } })
    await tx.crmTask.updateMany({ where: { personId: sourceId }, data: { personId: targetId } })
    await tx.crmSourceRecord.updateMany({ where: { personId: sourceId }, data: { personId: targetId } })
    await tx.crmResearchItem.updateMany({ where: { personId: sourceId }, data: { personId: targetId } })
    await tx.productFeedback.updateMany({ where: { personId: sourceId }, data: { personId: targetId } })

    const targetAuthorItems = await tx.crmResearchAuthor.findMany({ where: { personId: targetId }, select: { itemId: true } })
    for (const r of targetAuthorItems) {
      await tx.crmResearchAuthor.deleteMany({ where: { personId: sourceId, itemId: r.itemId } })
    }
    await tx.crmResearchAuthor.updateMany({ where: { personId: sourceId }, data: { personId: targetId } })

    const targetSegments = await tx.crmSegmentMember.findMany({ where: { personId: targetId }, select: { segmentId: true } })
    for (const s of targetSegments) {
      await tx.crmSegmentMember.deleteMany({ where: { personId: sourceId, segmentId: s.segmentId } })
    }
    await tx.crmSegmentMember.updateMany({ where: { personId: sourceId }, data: { personId: targetId } })

    const targetBroadcasts = await tx.crmBroadcastRecipient.findMany({ where: { personId: targetId }, select: { broadcastId: true } })
    for (const b of targetBroadcasts) {
      await tx.crmBroadcastRecipient.deleteMany({ where: { personId: sourceId, broadcastId: b.broadcastId } })
    }
    await tx.crmBroadcastRecipient.updateMany({ where: { personId: sourceId }, data: { personId: targetId } })

    // A suggestion that was previously promoted into the source should point
    // at the surviving record, or accepting it again would recreate the
    // person this merge just folded away.
    await tx.crmSuggestedContact.updateMany({ where: { createdPersonId: sourceId }, data: { createdPersonId: targetId } })

    // Clear the source's slug (and soft-delete it) BEFORE the target claims
    // it — @unique on linkedinSlug means both rows briefly holding the same
    // value, even for one statement, throws P2002. This order must not
    // change without re-checking that.
    await tx.crmPerson.update({ where: { id: sourceId }, data: { deletedAt: new Date(), linkedinSlug: null, mergedIntoId: targetId } })

    // Fill only what the target is missing — an explicit merge target's own
    // data always wins over the record being absorbed into it.
    await tx.crmPerson.update({
      where: { id: targetId },
      data: {
        email: target.email ?? source.email,
        emails: Array.from(new Set([...target.emails, ...source.emails])),
        phone: target.phone ?? source.phone,
        linkedinSlug: target.linkedinSlug ?? source.linkedinSlug,
        linkedinUrl: target.linkedinUrl ?? source.linkedinUrl,
        notes: target.notes ?? source.notes,
        connectedAt: target.connectedAt ?? source.connectedAt,
      },
    })
  })

  await refreshTouchFields([targetId])
  return { sourceName: source.fullName, targetName: target.fullName }
}
