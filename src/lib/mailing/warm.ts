import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { isWarmPerson, type WarmFacts } from './warm-rules'

const CHUNK = 500

/**
 * Works out which pending recipients of one edition are warm and flags them, so the send job sends them first and holds
 * everyone else to the cold daily cap (Microsoft and Gmail judge a sender by how recipients respond; a large first send to
 * people who never heard of us is what gets a young sending domain filtered).
 *
 * Reads: one CrmPerson row (four columns) per recipient with a personId, and their earlier engaged list-mail rows through
 * the personId index. About one roster's worth of rows, once per edition (warmMarkedAt), never per send.
 */
export async function markWarmRecipients(editionId: string): Promise<{ warm: number; cold: number }> {
  const pending = await prisma.mailingEditionRecipient.findMany({
    where: { editionId, status: 'PENDING' },
    select: { id: true, personId: true },
  })
  const personIds = [...new Set(pending.map((r) => r.personId).filter((x): x is string => !!x))]

  const facts = new Map<string, WarmFacts>()
  for (let i = 0; i < personIds.length; i += CHUNK) {
    const ids = personIds.slice(i, i + CHUNK)
    const people = await prisma.crmPerson.findMany({
      where: { id: { in: ids } },
      select: { id: true, warmth: true, emailSource: true, linkedinDegree: true, connectedAt: true },
    })
    for (const p of people) {
      facts.set(p.id, { warmth: p.warmth, emailSource: p.emailSource, linkedinDegree: p.linkedinDegree, connected: !!p.connectedAt, engagedBefore: false })
    }
    // A human open, click or reply on earlier list mail. Bot opens and scanner clicks are never stored in these columns.
    const engaged = await prisma.mailingEditionRecipient.findMany({
      where: { personId: { in: ids }, editionId: { not: editionId }, OR: [{ openedAt: { not: null } }, { clickedAt: { not: null } }, { repliedAt: { not: null } }] },
      select: { personId: true },
      distinct: ['personId'],
    })
    for (const e of engaged) {
      const f = facts.get(e.personId!)
      if (f) f.engagedBefore = true
    }
  }

  const warmIds = pending.filter((r) => r.personId && facts.has(r.personId) && isWarmPerson(facts.get(r.personId)!)).map((r) => r.id)
  for (let i = 0; i < warmIds.length; i += CHUNK) {
    await prisma.mailingEditionRecipient.updateMany({ where: { id: { in: warmIds.slice(i, i + CHUNK) } }, data: { warm: true } })
  }
  await prisma.mailingEdition.update({ where: { id: editionId }, data: { warmMarkedAt: new Date() } })
  const result = { warm: warmIds.length, cold: pending.length - warmIds.length }
  captureServerEvent('system', 'mailing_edition_warm_marked', { editionId, ...result })
  return result
}
