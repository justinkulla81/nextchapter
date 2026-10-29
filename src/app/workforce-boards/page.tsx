import { pageMetadata } from '@/lib/seo/keywords'
import type { Metadata } from 'next'
import Link from 'next/link'
import { B2bAssetBox } from '@/components/marketing/B2bAssetBox'
import { SeoPage, H2, LINK, ActionBand } from '@/components/seo/SeoPage'
import { stateName, stateSlug } from '@/lib/seo/states'
import { getStatesWithBoards } from '@/lib/seo/workforce-pages'

export const revalidate = 86400

export const metadata: Metadata = pageMetadata('/workforce-boards')

export default async function WorkforceHubPage() {
  const states = (await getStatesWithBoards()).sort((a, b) => stateName(a.state).localeCompare(stateName(b.state)))
  const boards = states.reduce((s, x) => s + x.boards, 0)
  const centers = states.reduce((s, x) => s + x.centers, 0)
  return (
    <SeoPage
      look="audience"
      trail={[{ name: 'Workforce boards', path: '/workforce-boards' }]}
      h1="Workforce development boards and American Job Centers"
      lede={<>{boards.toLocaleString()} local workforce boards and {centers.toLocaleString()} American Job Centers across {states.length} states, from the public CareerOneStop directory. Pick a state to see its boards, local unemployment and recent layoff notices.</>}
    >
      <section aria-labelledby="states" className="mt-10">
        <h2 id="states" className={H2}>Browse by state</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {states.map((s) => (
            <li key={s.state} className="rounded-xl border border-border bg-white p-4 text-sm">
              <Link href={`/workforce-boards/${stateSlug(s.state)}`} className={`${LINK} font-medium`}>{stateName(s.state)}</Link>
              <p className="mt-1 text-xs text-muted-foreground">{s.boards} {s.boards === 1 ? 'board' : 'boards'} · {s.centers} job {s.centers === 1 ? 'center' : 'centers'}</p>
            </li>
          ))}
        </ul>
      </section>
      <section aria-label="Free demo" className="mt-10">
        <B2bAssetBox assetKey="workforce-demo" page="workforce_hub" />
      </section>

      <ActionBand
        title="Run a workforce board?"
        body="Claim your board’s page and set up a free workspace. Use a work email at your organization’s domain."
        label="See how a board claims its page"
        href="/government-workforce#claim"
        event="seo_claim_clicked"
        properties={{ page: 'workforce_hub', audience: 'workforce' }}
      />
    </SeoPage>
  )
}
