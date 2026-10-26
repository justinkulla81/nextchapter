import { workforceBoardSeo } from '@/lib/seo/templates'
import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { OrgPageView } from '@/components/seo/OrgPageView'
import { canonical } from '@/lib/seo/canonical'
import { areaHiring, claimSlugFor, getOrgPage, renamedOrgSlug } from '@/lib/seo/org-pages'
import { stateName } from '@/lib/seo/states'
import { titleMeta } from '@/lib/seo/title'

// A workforce board's page: who it is and what it serves, plus (shared with the job center and economic development
// pages, src/components/seo/OrgPageView.tsx) the jobs open in its area, the employers hiring, colleges and the
// other partners there. A page below the content bar (src/lib/seo/org-page-rules.ts) renders but is noindex.
export const revalidate = 86400
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
    title: titleMeta(workforceBoardSeo(row.name, row.state).title),
    description: `${row.name} in ${stateName(row.state)}: the area it serves, ${blocks.jobsOpen.toLocaleString('en-US')} open professional jobs there, local unemployment and the American Job Centers where job seekers and employers get help.`,
    ...canonical(`/workforce-boards/${state}/${board}`),
    ...(p.indexable ? {} : { robots: { index: false, follow: true } }),
  }
}

export default async function WorkforceBoardPage({ params }: { params: Params }) {
  const { state, board } = await params
  const p = await getOrgPage('WORKFORCE_BOARD', state, board)
  if (!p) {
    // The address was an organization's old slug (records merged since): send it to the current page.
    const current = await renamedOrgSlug('WORKFORCE_BOARD', state, board)
    if (current) permanentRedirect(`/workforce-boards/${state}/${current}`)
    notFound()
  }
  const [hiring, claim] = await Promise.all([areaHiring(p.row.state, p.area), claimSlugFor('WORKFORCE_BOARD', p.row.id)])
  return <OrgPageView h1={workforceBoardSeo(p.row.name, p.row.state).h1} page={p} path={`/workforce-boards/${state}/${board}`} hiring={hiring} claimSlug={claim} />
}
