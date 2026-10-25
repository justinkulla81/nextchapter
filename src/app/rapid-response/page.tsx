import { pageMetadata } from '@/lib/seo/keywords'
import type { Metadata } from 'next'
import Link from 'next/link'
import { SeoPage, H2, LINK } from '@/components/seo/SeoPage'
import { canonical } from '@/lib/seo/canonical'
import { stateName, stateSlug } from '@/lib/seo/states'
import { getStatesWithBoards } from '@/lib/seo/workforce-pages'

export const revalidate = 86400

export const metadata: Metadata = pageMetadata('/rapid-response')

export default async function RapidResponseHubPage() {
  const states = (await getStatesWithBoards()).sort((a, b) => stateName(a.state).localeCompare(stateName(b.state)))
  return (
    <SeoPage
      trail={[{ name: 'Rapid response', path: '/rapid-response' }]}
      h1="Rapid response and layoff support for employers"
      lede={<>Before a layoff, an employer should know the notice rules and the local help available to its people. Start with the <Link href="/tools/warn-act-checker" className={LINK}>free WARN Act checker</Link>, then find your state’s workforce boards and job centers.</>}
    >
      <section aria-labelledby="states" className="mt-10">
        <h2 id="states" className={H2}>Choose your state</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {states.map((s) => (
            <li key={s.state} className="rounded-xl border border-border bg-white p-4 text-sm">
              <Link href={`/rapid-response/${stateSlug(s.state)}`} className={`${LINK} font-medium`}>{stateName(s.state)}</Link>
            </li>
          ))}
        </ul>
      </section>
    </SeoPage>
  )
}
