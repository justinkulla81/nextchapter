import type { Metadata } from 'next'
import Link from 'next/link'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { getAreaBrief } from '@/lib/workforce/area-brief-data'
import { stateCode } from '@/lib/workforce/area-brief'
import { STATE_NAMES } from '@/lib/workforce/places'
import { visibleBoards } from '@/lib/workforce/board-area'
import { AreaBriefView } from '@/components/workforce/AreaBriefView'
import { WorkforceBoardPanel } from '@/components/workforce/WorkforceBoardPanel'

export const metadata: Metadata = { title: 'Your local market' }

// What is happening where you live: how other NextChapter members are doing
// (anonymous counts), layoffs filed, who is hiring and local news. If you work
// with a workforce board, its area; otherwise your state.
export default async function LocalMarketPage() {
  const profile = await getDashboardProfile()
  const code = stateCode(profile.currentState, STATE_NAMES)

  if (!code) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Your local market</h1>
        <p className="text-muted-foreground">
          Add your city and state on your{' '}
          <Link href="/dashboard/profile/personal" className="text-primary underline underline-offset-4">
            profile
          </Link>{' '}
          and we will show you what is happening around you: layoffs, who is hiring, local news, and how other members are doing.
        </p>
      </div>
    )
  }

  const [stateBoards, connections] = await Promise.all([
    prisma.workforceBoard.findMany({ where: { state: code }, select: { id: true, name: true, website: true, state: true, statewide: true }, orderBy: { name: 'asc' } }),
    prisma.workforceBoardConnection.findMany({ where: { candidateId: profile.id, status: 'ACTIVE' }, select: { boardId: true, shareOutcome: true, board: { select: { name: true } } } }),
  ])
  const boards = visibleBoards(stateBoards)
  const brief = await getAreaBrief(connections[0] ? { boardId: connections[0].boardId } : { state: code })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your local market</h1>
        <p className="mt-1 text-muted-foreground">
          {brief ? `What is happening in ${brief.area.name}.` : 'What is happening where you live.'} Other members appear only as anonymous counts.
        </p>
      </div>

      {brief ? (
        <AreaBriefView brief={brief} audience="member" />
      ) : (
        <p className="text-sm text-muted-foreground">We could not load your area just now. Reload the page in a few minutes.</p>
      )}

      <WorkforceBoardPanel
        boards={boards.map((b) => ({ id: b.id, name: b.name, website: b.website }))}
        connections={connections.map((c) => ({ boardId: c.boardId, name: c.board.name, shareOutcome: c.shareOutcome }))}
      />
    </div>
  )
}
