import { workforceBoardSeo } from '@/lib/seo/templates'

/** The official name with the name the board goes by, when it has one: "Greater Louisville Workforce Development Board (KentuckianaWorks)". */
const boardDisplayName = (r: { name: string; knownAs?: string | null }) => (r.knownAs ? `${r.name} (${r.knownAs})` : r.name)
import { publishedContentForSource } from '@/lib/public-page/store'
import type { Metadata } from 'next'
import { notFound, permanentRedirect, redirect } from 'next/navigation'
import { eventsForEmployerNames } from '@/lib/events/sec-events'
import { noticesForOrgPage } from '@/lib/seo/org-notices'
import { OrgPageView } from '@/components/seo/OrgPageView'
import { canonical } from '@/lib/seo/canonical'
import { areaHiring, claimSlugFor, getOrgPage, isOrgStateSlug, renamedOrgSlug } from '@/lib/seo/org-pages'
import { stateName } from '@/lib/seo/states'
import { titleMeta } from '@/lib/seo/title'
import { getOrgBrand } from '@/lib/branding/store'
import { boardWageHistory } from '@/lib/workforce/board-wage-history'
import { boardConnectionCount } from '@/lib/affiliations/public-count'

// A workforce board's page: who it is and what it serves, plus (shared with the job center and economic development
// pages, src/components/seo/OrgPageView.tsx) the jobs open in its area, the employers hiring, colleges and the
// other partners there. A page below the content bar (src/lib/seo/org-page-rules.ts) renders but is noindex.
export const revalidate = 604800 // 7 days: slow-changing page, one of the larger ISR write sources
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

type Params = Promise<{ state: string; board: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { state, board } = await params
  const p = await getOrgPage('WORKFORCE_BOARD', state, board)
  if (!p) return {}
  const { row, blocks } = p
  return {
    title: titleMeta(workforceBoardSeo(boardDisplayName(row), row.state).title),
    description: `${row.name} in ${stateName(row.state)}: the area it serves, ${blocks.jobsOpen.toLocaleString('en-US')} open professional jobs there, local unemployment and the American Job Centers where job seekers and employers get help.`,
    ...canonical(`/workforce-boards/${state}/${board}`),
    ...(p.indexable ? {} : { robots: { index: false, follow: true } }),
  }
}

export default async function WorkforceBoardPage({ params }: { params: Params }) {
  const { state, board } = await params
  const p = await getOrgPage('WORKFORCE_BOARD', state, board)
  if (!p) {
    // The address was an organization's old slug (records merged since), or a cut-off or mistyped link: send it to the nearest
    // current page, else to the state's list (unknown slugs go to the nearest real page, not a 404).
    const current = await renamedOrgSlug('WORKFORCE_BOARD', state, board)
    if (current) permanentRedirect(`/workforce-boards/${state}/${current}`)
    if (isOrgStateSlug(state)) redirect(`/workforce-boards/${state}`)
    notFound()
  }
  const [hiring, claim, notices, brand, peopleCount, own, wageHistory] = await Promise.all([
    areaHiring(p.row.state, p.area),
    claimSlugFor('WORKFORCE_BOARD', p.row.id),
    noticesForOrgPage(p),
    getOrgBrand('WORKFORCE_BOARD', p.row.id),
    boardConnectionCount([p.row.id, ...(p.row.aliasIds ?? [])]),
    publishedContentForSource('WORKFORCE_BOARD', p.row.id),
    boardWageHistory(p.row.id).catch(() => null),
  ])
  const events = await eventsForEmployerNames(hiring.employers.map((e) => e.name)).catch(() => [])
  return <OrgPageView h1={workforceBoardSeo(boardDisplayName(p.row), p.row.state).h1} page={p} path={`/workforce-boards/${state}/${board}`} hiring={hiring} claimSlug={claim} notices={notices} events={events} brand={brand?.pair ?? null} peopleCount={peopleCount} own={own} wageHistory={wageHistory} />
}
