import type { Metadata } from 'next'
import { Section } from '@/components/topics/blocks'
import { PAY_DATA, PayDataFrame, PayDataPending } from '@/components/pay-data/PayDataFrame'
import { GroupTable } from '@/components/pay-data/PayTables'
import { loadPayData, snapshotMonths } from '@/lib/pay-data/load'
import { dateText, num, signedPct } from '@/lib/pay-data/text'
import { pageMetadata } from '@/lib/seo/keywords'

export const revalidate = 21600
const PATH = `${PAY_DATA}/hiring`
export const metadata: Metadata = pageMetadata(PATH)

/** Months of openings snapshots needed before a growth comparison is shown: growth is a change between two months, and one change is noise. */
const MONTHS_FOR_GROWTH = 4

export default async function PayHiringPage() {
  const [d, months] = await Promise.all([loadPayData(), snapshotMonths()])
  if (!d) return <PayDataPending path={PATH} title="Pay by hiring volume" />
  const rows = d.byScale
  const busiest = rows[rows.length - 1]
  const first = months[0]
  const faq = [
    {
      q: 'Do employers that are hiring more pay more?',
      a: busiest && busiest.likePct !== undefined
        ? `By hiring volume, employers with ${busiest.label.replace(' jobs open', '')} jobs open advertise ${signedPct(busiest.likePct)} against other employers once function, level and industry are matched. Volume is how many jobs an employer has open now; it is not growth.`
        : 'The comparison by hiring volume publishes with the next daily run.',
    },
    { q: 'Where are the hiring growth figures?', a: `Growth needs the same employers measured month after month. We store every paid-pay employer's openings count once a month${first ? `, starting ${first}` : ''}, and will publish growth once ${MONTHS_FOR_GROWTH} months are in. Until then we show hiring volume and do not estimate growth from older data.` },
  ]
  return (
    <PayDataFrame
      path={PATH}
      trail={[{ name: 'Pay data', path: PAY_DATA }, { name: 'Pay and hiring', path: PATH }]}
      title="Pay and hiring: advertised pay by how much an employer is hiring"
      intro={`Advertised pay by the number of jobs an employer has open now, from ${num(d.overall.n)} live postings, with the gap against other employers once function, level and industry are matched. Hiring growth follows as months of data build up. As of ${dateText(d.computedAt)}.`}
      asOf={d.computedAt}
      datasetName="Advertised pay in U.S. professional job postings, by employer hiring volume"
      datasetDescription="Median, quartiles, sample sizes and the like-for-like pay gap by how many jobs an employer has open, and the status of the hiring growth series."
      faq={faq}
      csv={`${PAY_DATA}/data.csv`}
    >
      <Section id="volume" title="Pay by jobs open now" note="Hiring volume is the employer's count of live postings on the board today. It rises with employer size and with how much of its hiring appears on public career sites.">
        <GroupTable caption="Advertised pay by hiring volume" rows={rows} />
      </Section>
      <Section id="growth" title="Hiring growth" note="Not shown yet.">
        <p className="max-w-3xl text-base leading-relaxed text-navy">
          {months.length === 0
            ? 'We began storing a monthly count of every employer’s open jobs with this release.'
            : `We have ${months.length} monthly ${months.length === 1 ? 'snapshot' : 'snapshots'} so far (${months.join(', ')}).`}{' '}
          Growth is the change in an employer’s openings from one month to the next, so it needs several months of the same employers. When {MONTHS_FOR_GROWTH} months are stored, this page adds pay for employers whose hiring is rising, steady or falling.
          We do not infer growth from when a posting was first seen, because the crawl only reaches back a few months and would read every employer as growing.
        </p>
      </Section>
    </PayDataFrame>
  )
}
