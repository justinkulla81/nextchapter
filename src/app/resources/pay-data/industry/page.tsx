import type { Metadata } from 'next'
import { Section } from '@/components/topics/blocks'
import { PAY_DATA, PayDataFrame, PayDataPending } from '@/components/pay-data/PayDataFrame'
import { GroupTable } from '@/components/pay-data/PayTables'
import { loadPayData } from '@/lib/pay-data/load'
import { industryPayPath } from '@/lib/pay-data/slugs'
import { dateText, num, usd } from '@/lib/pay-data/text'
import { pageMetadata } from '@/lib/seo/keywords'

export const revalidate = 21600
const PATH = `${PAY_DATA}/industry`
export const metadata: Metadata = pageMetadata(PATH)

export default async function PayIndustryPage() {
  const d = await loadPayData()
  if (!d) return <PayDataPending path={PATH} title="Pay by industry" />
  const rows = d.byIndustry
  const top = rows[0]
  const faq = [
    { q: 'Which industries pays the most?', a: top ? `By median advertised pay, ${top.label} leads at ${usd(top.p50)} (${num(top.n)} paid postings from ${num(top.companies)} employers). The table also shows each group's gap with the rest of the job mix matched.` : 'The table publishes with the next daily run.' },
    { q: 'Why show a gap with the job mix matched?', a: 'A raw median mixes in which roles and levels a group happens to hold. The matched gap compares postings of the same function, level and industry, so it shows what is left after that.' },
  ]
  return (
    <PayDataFrame
      path={PATH}
      trail={[{ name: 'Pay data', path: PAY_DATA }, { name: 'Pay by industry', path: PATH }]}
      title="Salary by industry: what U.S. professional jobs advertise"
      intro={`Median and middle-half advertised pay for ${rows.length} industries, from ${num(d.overall.n)} live postings that state pay, with the gap against other industries once the job mix is matched. As of ${dateText(d.computedAt)}.`}
      asOf={d.computedAt}
      datasetName="Advertised pay in U.S. professional job postings, by industry"
      datasetDescription="Median, quartiles, sample sizes and the like-for-like pay gap for each industry group."
      faq={faq}
      csv={`${PAY_DATA}/data.csv`}
    >
      <Section id="table" title="Pay by industry" note="Sorted by median. Open one for its pay by level.">
        <GroupTable caption="Advertised pay by industry" rows={rows} href={(g) => industryPayPath(g.key)} />
      </Section>
    </PayDataFrame>
  )
}
