import 'server-only'
import { prisma } from '@/lib/prisma'

// Figures that take a pass over the whole open board are computed by the cron /api/cron/board-figures and stored in
// BoardFigure. Pages read the stored row (a primary-key lookup) instead of running the scan themselves.
export type BoardFigureKey = 'employer-rankings' | 'function-rankings' | 'workforce-jobs' | 'exposure-rows'

export async function readBoardFigure<T>(key: BoardFigureKey): Promise<T | null> {
  const row = await prisma.boardFigure.findUnique({ where: { key }, select: { payload: true } })
  return row ? (row.payload as unknown as T) : null
}

export async function writeBoardFigure(key: BoardFigureKey, payload: unknown): Promise<void> {
  const data = payload as object
  await prisma.boardFigure.upsert({
    where: { key },
    create: { key, payload: data, computedAt: new Date() },
    update: { payload: data, computedAt: new Date() },
  })
}
