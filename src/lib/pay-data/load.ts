import 'server-only'
import { cache } from 'react'
import { readBoardFigure } from '@/lib/jobs/stored-board-figures'
import type { PayData } from './types'

/** The stored pay figures (written by the pay-data cron); null until the first run. One primary-key read, shared within a render. */
export const loadPayData = cache(async (): Promise<PayData | null> => readBoardFigure<PayData>('pay-data'))

/** How many monthly openings snapshots are stored: hiring growth is shown once there are enough months to compare. */
export async function snapshotMonths(): Promise<string[]> {
  const { prisma } = await import('@/lib/prisma')
  const rows = await prisma.boardFigure.findMany({ where: { key: { startsWith: 'pay-data-snapshot:' } }, select: { key: true }, orderBy: { key: 'asc' } })
  return rows.map((r) => r.key.slice('pay-data-snapshot:'.length))
}
