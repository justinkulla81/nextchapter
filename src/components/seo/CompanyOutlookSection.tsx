import Link from 'next/link'
import { layoffNoticesYearBefore } from '@/lib/seo/company-outlook-data'
import { H2, LINK } from '@/components/seo/SeoPage'
import { companyOutlook } from '@/lib/seo/company-outlook'
import { industryOutlook } from '@/lib/seo/industry-outlook'
import { getIndustryTrends } from '@/lib/market/bls-industry-trends'
import { getIndustryJolts } from '@/lib/market/bls-industry-jolts'
import { JOLTS_CODE_BY_BUCKET } from '@/lib/market/industry-jolts-data'
import { getPlaceSignals } from '@/lib/places/signals'
import type { Hub } from '@/lib/places/hubs'
import { bucketFromIndustryText, industryPath } from '@/lib/seo/topics'

/**
 * The company's outlook with its evidence, then the outlook of its industry and of its main hub area beside it as
 * context (they are not scored into the company's label). Renders nothing when there is not enough data.
 */
export async function CompanyOutlookSection({ name, companyId, industry, hiring, layoffs12, fundraises12, hubs }: {
  name: string
  companyId: string
  industry: string | null
  hiring: { openNow: number; opened90d: number } | null
  layoffs12: number
  fundraises12: number
  hubs: Hub[]
}) {
  // Federal contract awards are not fed in yet: the sync matches recipient names exactly, and a common name can match an
  // unrelated vendor. They join the outlook once those matches are checked.
  const layoffs24 = await layoffNoticesYearBefore(companyId)
  const o = companyOutlook({ layoffs12, layoffs12to24: layoffs24, fundraises12, federal: null, hiring })
  if (o.label === 'Not enough data') return null

  const bucket = bucketFromIndustryText(industry)
  const [trends, jolts] = bucket ? await Promise.all([getIndustryTrends(), getIndustryJolts()]) : [{}, {}]
  const ind = bucket ? industryOutlook(trends[bucket], jolts[bucket], JOLTS_CODE_BY_BUCKET[bucket]?.label) : null
  const hub = hubs.find((h) => h.href && h.countyFips)
  const area = hub?.countyFips ? await getPlaceSignals([hub.countyFips]).catch(() => null) : null

  return (
    <section aria-labelledby="outlook" className="mt-10">
      <h2 id="outlook" className={H2}>{name} outlook: {o.label}</h2>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        From public records and our own hiring data, as of the last check. It looks at layoff notices, capital raised and how fast roles are opening. It does not judge the company by its industry or its city.
      </p>
      <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        {o.evidence.map((x) => <li key={x}>{x}</li>)}
      </ul>
      {((ind && ind.label !== 'Not enough data' && bucket) || (area && area.outlook.label !== 'Not enough data' && hub)) && (
        <>
          <h3 className="mt-6 text-sm font-semibold text-navy">Context</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {ind && ind.label !== 'Not enough data' && bucket && (
              <li>Its industry, <Link href={industryPath(bucket)} className={LINK}>{bucket}</Link>, is {ind.label.toLowerCase()} nationally. <Link href={`${industryPath(bucket)}#learn`} className={LINK}>Learn the skills it asks for</Link>.</li>
            )}
            {area && area.outlook.label !== 'Not enough data' && hub && hub.href && (
              <li>Its main hub, <Link href={hub.href} className={LINK}>{hub.label}</Link>, sits in a county that is {area.outlook.label.toLowerCase()}.</li>
            )}
          </ul>
        </>
      )}
    </section>
  )
}
