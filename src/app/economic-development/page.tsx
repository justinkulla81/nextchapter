import type { Metadata } from 'next'
import Link from 'next/link'
import { SeoPage, H2, LINK } from '@/components/seo/SeoPage'
import { canonical } from '@/lib/seo/canonical'
import { ALL_STATE_CODES, stateName, stateSlug } from '@/lib/seo/states'

export const metadata: Metadata = {
  title: 'Economic development organizations by state',
  description: 'Economic development organizations in every state: the counties each serves, the professional jobs open there and how to reach it.',
  ...canonical('/economic-development'),
}

export default function Page() {
  return (
    <SeoPage look="audience" trail={[{ name: 'Economic development organizations', path: '/economic-development' }]} h1="Economic development organizations" lede={<>The regional and state economic development organizations that bring employers to each area, with the counties each serves, the professional jobs open there and how to reach it.</>}>
      <section aria-labelledby="states" className="mt-10">
        <h2 id="states" className={H2}>Choose a state</h2>
        <ul className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-4">
          {ALL_STATE_CODES.map((c) => <li key={c}><Link href={`/economic-development/${stateSlug(c)}`} className={LINK}>{stateName(c)}</Link></li>)}
        </ul>
      </section>
    </SeoPage>
  )
}
