import type { Metadata } from 'next'
import { Section } from '@/components/topics/blocks'
import { PAY_DATA, PayDataFrame, PayDataPending } from '@/components/pay-data/PayDataFrame'
import { GroupTable } from '@/components/pay-data/PayTables'
import { loadPayData } from '@/lib/pay-data/load'
import { functionPayPath } from '@/lib/pay-data/slugs'
import { dateText, num, usd } from '@/lib/pay-data/text'
import { pageMetadata } from '@/lib/seo/keywords'

export const revalidate = 21600
const PATH = `${PAY_DATA}/function`
export const metadata: Metadata = pageMetadata(PATH)

export default async function PayFunctionPage() {
  const d = await loadPayData()
  if (!d) return <PayDataPending path={PATH} title="Pay by function" />
  const rows = d.byFunction
  const top = rows[0]
  const faq = [
    { q: 'Which functions pays the most?', a: top ? `By median advertised pay, ${top.label} leads at ${usd(top.p50)} (${num(top.n)} paid postings from ${num(top.companies)} employers). The table also shows each group's gap with the rest of the job mix matched.` : 'The table publishes with the next daily run.' },
    { q: 'Why show a gap with the job mix matched?', a: 'A raw median mixes in which roles and levels a group happens to hold. The matched gap compares postings of the same function, level and industry, so it shows what is left after that.' },
  ]
  return (
    <PayDataFrame
      path={PATH}
      trail={[{ name: 'Pay data', path: PAY_DATA }, { name: 'Pay by function', path: PATH }]}
      title="Salary by function: what U.S. professional jobs advertise"
      intro={`Median and middle-half advertised pay for ${rows.length} functions, from ${num(d.overall.n)} live postings that state pay, with the gap against other functions once the job mix is matched. As of ${dateText(d.computedAt)}.`}
      asOf={d.computedAt}
      datasetName="Advertised pay in U.S. professional job postings, by function"
      datasetDescription="Median, quartiles, sample sizes and the like-for-like pay gap for each function group."
      faq={faq}
      csv={`${PAY_DATA}/data.csv`}
    >
      <Section id="table" title="Pay by function" note="Sorted by median. Open one for its pay by level.">
        <GroupTable caption="Advertised pay by function" rows={rows} href={(g) => functionPayPath(g.label)} />
      </Section>
    </PayDataFrame>
  )
}
