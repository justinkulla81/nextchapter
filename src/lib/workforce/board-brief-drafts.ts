import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { getAreaBrief } from './area-brief-data'
import { boardBriefHtml, boardBriefPeriod } from './board-brief'

const PER_RUN = 25

// Monthly: a DRAFT edition in the mailing queue for each board that has a
// director or chair email and something worth saying. It never sends and has
// no readership; you approve the text and choose who it goes to on the edition
// page. A board gets one draft per month (the key makes it so).
export async function draftBoardBriefs(now = new Date()) {
  const { key: month, label } = boardBriefPeriod(now)
  const boards = await prisma.workforceBoard.findMany({
    where: { OR: [{ directorEmail: { not: null } }, { chairEmail: { not: null } }] },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
  const existing = new Set(
    (await prisma.mailingEdition.findMany({ where: { key: { endsWith: `-${month}`, startsWith: 'board-brief-' } }, select: { key: true } })).map((e) => e.key)
  )
  let drafted = 0
  let skipped = 0
  for (const board of boards) {
    if (drafted >= PER_RUN) break
    const key = `board-brief-${board.id}-${month}`
    if (existing.has(key)) continue
    try {
      const brief = await getAreaBrief({ boardId: board.id }, now, { warmCounties: true })
      const html = brief ? boardBriefHtml(brief, label) : null
      if (!html) {
        skipped += 1
        continue
      }
      const edition = await prisma.mailingEdition.create({
        data: { key, title: `${label} board brief: ${board.name}`, subject: `${label} brief for ${board.name}`, bodyHtml: html, createdByEmail: 'board-brief-job' },
      })
      drafted += 1
      captureServerEvent('board-brief-job', 'board_brief_drafted', { editionId: edition.id, boardId: board.id, month })
    } catch (error) {
      // The unique key makes a concurrent run fail here rather than draft twice.
      console.error('Board brief draft failed for board', board.id, error)
    }
  }
  return { boards: boards.length, drafted, skipped }
}
