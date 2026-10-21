import type { Metadata } from 'next'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { getAreaBrief } from '@/lib/workforce/area-brief-data'
import { stateCode } from '@/lib/workforce/area-brief'
import { STATE_NAMES } from '@/lib/workforce/places'
import { visibleBoards } from '@/lib/workforce/board-area'
import { AreaBriefView } from '@/components/workforce/AreaBriefView'
import { PageHeader } from '@/components/candidate/PageHeader'
import { ShowMore } from '@/components/candidate/ShowMore'
import { ActionLink } from '@/components/candidate/ActionLink'
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
      <div className="space-y-8">
        <PageHeader
          title="Local market"
          intro="Who is hiring near you, so you can look in person as well as online."
          action={
            <ActionLink href="/dashboard/profile/personal" kind="primary" event="local_market_add_city_clicked" props={{ source: 'local_market' }}>
              Add your city and state
            </ActionLink>
          }
        />
        <p className="max-w-2xl text-base text-muted-foreground">
          Add your city and state and we will show you what is happening around you: layoffs, who is hiring, local news, and how other members are doing.
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

  const boardPanel = (
    <WorkforceBoardPanel
      boards={boards.map((b) => ({ id: b.id, name: b.name, website: b.website }))}
      connections={connections.map((c) => ({ boardId: c.boardId, name: c.board.name, shareOutcome: c.shareOutcome }))}
    />
  )

  return (
    <div className="space-y-8">
      <PageHeader
        title="Local market"
        intro={`${brief ? `What is happening in ${brief.area.name}.` : 'What is happening where you live.'} Other members appear only as anonymous counts.`}
        action={
          <ActionLink href="/dashboard/find-my-job" kind="primary" event="local_market_see_jobs_clicked" props={{ source: 'local_market', area: brief?.area.name ?? null }}>
            See jobs near you
          </ActionLink>
        }
      />
      {brief ? (
        <AreaBriefView brief={brief} audience="member" redesign />
      ) : (
        <p className="text-base text-muted-foreground">We could not load your area just now. Reload the page in a few minutes and it will be here.</p>
      )}
      <ShowMore page="local_market" label="Show workforce boards near you">
        {boardPanel}
      </ShowMore>
    </div>
  )
}
