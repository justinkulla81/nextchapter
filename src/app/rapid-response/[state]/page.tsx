import { meetsStateBoardBar } from '@/lib/seo/page-bars'
import { rapidResponseStateSeo } from '@/lib/seo/templates'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SeoPage, H2, LINK, ActionBand } from '@/components/seo/SeoPage'
import { canonical } from '@/lib/seo/canonical'
import { stateFromSlug, stateName } from '@/lib/seo/states'
import { getStateBoards, getStateCenters, getStateLayoffs } from '@/lib/seo/workforce-pages'
import { titleMeta } from '@/lib/seo/title'

export const revalidate = 86400
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

async function load(slug: string) {
  const code = stateFromSlug(slug)
  if (!code) return null
  const boards = await getStateBoards(code)
  if (boards.length === 0) return null
  const [centers, layoffs] = await Promise.all([getStateCenters(code), getStateLayoffs(code)])
  return { code, name: stateName(code), boards, centers, layoffs }
}

export async function generateMetadata({ params }: { params: Promise<{ state: string }> }): Promise<Metadata> {
  const { state } = await params
  const d = await load(state)
  if (!d) return {}
  return {
    title: titleMeta(rapidResponseStateSeo(d.name).title),
    description: `Planning a layoff in ${d.name}? The federal WARN Act rules, the ${d.boards.length} local workforce ${d.boards.length === 1 ? 'board' : 'boards'} and ${d.centers.length} American Job Centers that help affected workers, and a free notice checker.`,
    ...canonical(`/rapid-response/${state}`),
    ...(meetsStateBoardBar(d.boards.length, d.centers.length) ? {} : { robots: { index: false, follow: true } }),
  }
}

export default async function RapidResponseStatePage({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params
  const d = await load(state)
  if (!d) notFound()

  return (
    <SeoPage
      trail={[{ name: 'Rapid response', path: '/rapid-response' }, { name: d.name, path: `/rapid-response/${state}` }]}
      h1={rapidResponseStateSeo(d.name).h1}
      lede={<>What an employer planning a layoff in {d.name} needs: the federal notice rules, the local workforce boards and American Job Centers that serve affected workers, and support for the people leaving.</>}
    >
      <section aria-labelledby="warn" className="mt-10">
        <h2 id="warn" className={H2}>Federal WARN Act notice</h2>
        <ul className="mt-4 max-w-3xl list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>The Worker Adjustment and Retraining Notification Act generally covers employers with 100 or more employees, not counting part-time workers.</li>
          <li>A covered employer gives 60 calendar days’ written notice before a plant closing or mass layoff.</li>
          <li>Notice goes to affected employees (or their union), the state dislocated worker unit, and the chief elected official of the local government.</li>
          <li>Some states have their own, broader notice laws. Check {d.name}’s with the state labor department or counsel.</li>
        </ul>
        <p className="mt-3 text-sm"><Link href="/tools/warn-act-checker" className={LINK}>Check whether WARN notice applies to your layoff</Link>. General information, not legal advice.</p>
      </section>

      <section aria-labelledby="boards" className="mt-12">
        <h2 id="boards" className={H2}>Workforce boards in {d.name}</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">State and local rapid response teams work with employers before and after a layoff to connect workers to services. Start with the board for the county where the workers are.</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {d.boards.map((b) => (
            <li key={b.id} className="rounded-xl border border-border bg-white p-4 text-sm">
              <Link href={`/workforce-boards/${state}/${b.slug}`} className={`${LINK} font-medium`}>{b.name}</Link>
              <p className="mt-1 text-xs text-muted-foreground">{b.statewide ? 'Statewide' : b.serviceArea ?? ''}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm"><Link href={`/workforce-boards/${state}`} className={LINK}>All {d.name} boards and {d.centers.length} job centers</Link></p>
      </section>

      {d.layoffs.notices > 0 && (
        <p className="mt-8 max-w-3xl text-sm text-muted-foreground">
          {d.layoffs.notices.toLocaleString()} WARN notices were filed in {d.name} in the last 12 months. <Link href={`/layoffs/${state}`} className={LINK}>See them</Link>.
        </p>
      )}

      <ActionBand
        title="Support for the people leaving"
        body="NextChapter provides outplacement for employers: coaching, a job search plan and reporting on outcomes."
        label="See outplacement for employers"
        href="/outplacement"
        event="seo_employer_cta_clicked"
        properties={{ page: 'rapid_response_state', audience: 'employer', state: d.code }}
      />
    </SeoPage>
  )
}
