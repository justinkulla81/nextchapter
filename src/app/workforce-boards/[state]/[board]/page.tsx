import { workforceBoardSeo } from '@/lib/seo/templates'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SeoPage, H2, LINK, Stat, ActionBand } from '@/components/seo/SeoPage'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { canonical } from '@/lib/seo/canonical'
import { stateFromSlug, stateName } from '@/lib/seo/states'
import { getBoardCounties, placeUrl } from '@/lib/places/places'
import { getBoardLabor, getStateBoards, getStateCenters, periodLabel, rateText } from '@/lib/seo/workforce-pages'

export const revalidate = 86400
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

async function load(stateSlugParam: string, boardSlug: string) {
  const code = stateFromSlug(stateSlugParam)
  if (!code) return null
  const boards = await getStateBoards(code)
  const board = boards.find((b) => b.slug === boardSlug)
  if (!board) return null
  const [centers, labor] = await Promise.all([getStateCenters(code), getBoardLabor(board)])
  const servedCounties = await getBoardCounties(board)
  const mine = centers.filter((c) => c.boardId === board.id)
  // A board with no linked centers falls back to the state's list, labeled as such.
  return { code, name: stateName(code), board, servedCounties, labor, centers: mine.length ? mine : centers, centersAreLocal: mine.length > 0 }
}

export async function generateMetadata({ params }: { params: Promise<{ state: string; board: string }> }): Promise<Metadata> {
  const { state, board } = await params
  const d = await load(state, board)
  if (!d) return {}
  return {
    title: workforceBoardSeo(d.board.name, d.code).title,
    description: `${d.board.name} in ${d.name}: the area it serves, local unemployment and the American Job Centers where job seekers and employers get help.`,
    ...canonical(`/workforce-boards/${state}/${board}`),
  }
}

export default async function WorkforceBoardPage({ params }: { params: Promise<{ state: string; board: string }> }) {
  const { state, board } = await params
  const d = await load(state, board)
  if (!d) notFound()
  const b = d.board

  return (
    <SeoPage
      trail={[{ name: 'Workforce boards', path: '/workforce-boards' }, { name: d.name, path: `/workforce-boards/${state}` }, { name: b.name, path: `/workforce-boards/${state}/${board}` }]}
      h1={workforceBoardSeo(b.name, d.code).h1}
      lede={<>{b.statewide ? `Serves all of ${d.name}.` : b.serviceArea ? `Serves ${b.serviceArea}.` : `A workforce development board in ${d.name}.`} Job seekers and employers reach it through the American Job Centers below.</>}
    >
      {d.labor && (
        <section aria-labelledby="labor" className="mt-10">
          <h2 id="labor" className={H2}>Local labor market</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-3">
            <Stat value={rateText(d.labor)} label={`unemployment, ${periodLabel(d.labor.period)}`} note={d.labor.rateYearAgo != null ? `${d.labor.rateYearAgo.toFixed(1)}% a year earlier` : undefined} />
            <Stat value={d.labor.unemployed.toLocaleString()} label="people unemployed" />
            <Stat value={d.labor.laborForce.toLocaleString()} label="in the labor force" note={`${d.labor.counties} ${d.labor.counties === 1 ? 'county' : 'counties'}, BLS`} />
          </ul>
        </section>
      )}

      {d.servedCounties.length > 0 && (
        <section aria-labelledby="counties" className="mt-12">
          <h2 id="counties" className={H2}>Counties served</h2>
          <ul className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {d.servedCounties.map((c) => (
              <li key={c.fips}><Link href={placeUrl.county(state, c.slug)} className={LINK}>{c.name}</Link></li>
            ))}
          </ul>
        </section>
      )}

      {d.centers.length > 0 && (
        <section aria-labelledby="centers" className="mt-12">
          <h2 id="centers" className={H2}>{d.centersAreLocal ? 'American Job Centers' : `American Job Centers in ${d.name}`}</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {d.centers.map((c) => (
              <li key={c.id} className="rounded-xl border border-border bg-white p-4 text-sm">
                <p className="font-medium text-navy">{c.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{[c.city, c.kind, c.phone].filter(Boolean).join(' · ')}</p>
                {c.hours && <p className="mt-1 text-xs text-muted-foreground">{c.hours}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {b.website && (
        <p className="mt-8 text-sm">
          <TrackedLink href={b.website} event="workforce_board_link_clicked" properties={{ boardId: b.id, state: d.code, page: 'workforce_board' }} className={LINK}>
            {b.name} website
          </TrackedLink>
        </p>
      )}

      <ActionBand
        title="Is this your board?"
        body="Claim this page and set up a free workspace. Use a work email at your organization’s domain."
        label="See how a board claims its page"
        href="/government-workforce#claim"
        event="seo_claim_clicked"
        properties={{ page: 'workforce_board', audience: 'workforce', state: d.code, boardId: b.id }}
      />

      <p className="mt-10 max-w-3xl text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Sources:</span> CareerOneStop (U.S. Department of Labor) for the board and centers; Bureau of Labor Statistics for unemployment.{' '}
        <Link href={`/workforce-boards/${state}`} className={LINK}>All {d.name} boards</Link>. <Link href={`/places/${state}`} className={LINK}>{d.name} by county and city</Link>.
      </p>
    </SeoPage>
  )
}
