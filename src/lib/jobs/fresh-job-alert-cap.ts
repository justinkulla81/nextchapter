import { Prisma } from '@prisma/client'

/**
 * Per-member cap for fresh-job alerts. The cron runs several times a day
 * (after the crawler's 3-hourly hot-tier imports), so the cap must hold across
 * runs and across overlapping runs: at most ONE alert per member per rolling
 * 24 hours, and never a posting already sent to that member.
 *
 * The check and the claim happen in one Serializable transaction: two runs
 * that both see "no alert in the last 24h" cannot both commit their claim —
 * Postgres aborts one with a serialization failure (Prisma P2034), which is
 * treated as "already alerted". FreshJobAlertSend's (candidateId, postingId)
 * unique index is the second guard against re-sending a posting.
 */

export const FRESH_ALERT_COOLDOWN_MS = 24 * 3_600_000

type SendRow = { postingId: string }

/** The slice of PrismaClient this needs — lets tests pass an in-memory fake. */
export interface FreshAlertCapTx {
  freshJobAlertSend: {
    findFirst(args: { where: { candidateId: string; sentAt: { gte: Date } } }): Promise<unknown | null>
    findMany(args: {
      where: { candidateId: string; postingId: { in: string[] } }
      select: { postingId: true }
    }): Promise<SendRow[]>
    createMany(args: {
      data: { candidateId: string; postingId: string; sentAt: Date }[]
      skipDuplicates: boolean
    }): Promise<unknown>
  }
}

export interface FreshAlertCapDb {
  $transaction<T>(
    fn: (tx: FreshAlertCapTx) => Promise<T>,
    options: { isolationLevel: Prisma.TransactionIsolationLevel }
  ): Promise<T>
}

export type ClaimResult =
  | { status: 'claimed'; postingIds: string[] }
  | { status: 'cooldown' }
  | { status: 'nothing_new' }

export async function claimFreshJobAlert(
  db: FreshAlertCapDb,
  candidateId: string,
  postingIds: string[],
  now: Date = new Date()
): Promise<ClaimResult> {
  if (postingIds.length === 0) return { status: 'nothing_new' }
  try {
    return await db.$transaction(
      async (tx): Promise<ClaimResult> => {
        const recent = await tx.freshJobAlertSend.findFirst({
          where: { candidateId, sentAt: { gte: new Date(now.getTime() - FRESH_ALERT_COOLDOWN_MS) } },
        })
        if (recent) return { status: 'cooldown' }
        const prior = await tx.freshJobAlertSend.findMany({
          where: { candidateId, postingId: { in: postingIds } },
          select: { postingId: true },
        })
        const sent = new Set(prior.map((p) => p.postingId))
        const fresh = postingIds.filter((id) => !sent.has(id))
        if (fresh.length === 0) return { status: 'nothing_new' }
        await tx.freshJobAlertSend.createMany({
          data: fresh.map((postingId) => ({ candidateId, postingId, sentAt: now })),
          skipDuplicates: true,
        })
        return { status: 'claimed', postingIds: fresh }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )
  } catch (error) {
    // Another run claimed this member at the same moment.
    if (isConflict(error)) return { status: 'cooldown' }
    throw error
  }
}

function isConflict(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code
  return code === 'P2034' || code === 'P2002'
}
