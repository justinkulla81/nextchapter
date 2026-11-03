import type { Metadata } from 'next'
import { LinkIndex } from '@/components/seo/LinkIndex'
import { SeoPage, H2 } from '@/components/seo/SeoPage'
import { canonical } from '@/lib/seo/canonical'
import { ALL_STATE_CODES, stateName, stateSlug } from '@/lib/seo/states'

export const metadata: Metadata = {
  title: 'American Job Centers by state',
  description: 'American Job Centers in every state: the counties each serves, the professional jobs open there and how to reach it.',
  ...canonical('/job-centers'),
}

export default function Page() {
  return (
    <SeoPage look="audience" trail={[{ name: 'American Job Centers', path: '/job-centers' }]} h1="American Job Centers" lede={<>Every American Job Center in the country, with the counties it serves, the professional jobs open there and how to reach it.</>}>
      <section aria-labelledby="states" className="mt-10">
        <h2 id="states" className={H2}>Choose a state</h2>
        <LinkIndex label="States" visible={60} items={ALL_STATE_CODES.map((c) => ({ href: `/job-centers/${stateSlug(c)}`, label: stateName(c) }))} />
      </section>
    </SeoPage>
  )
}
