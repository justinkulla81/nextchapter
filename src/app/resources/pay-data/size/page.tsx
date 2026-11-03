import type { Metadata } from 'next'
import { Section } from '@/components/topics/blocks'
import { PAY_DATA, PayDataFrame, PayDataPending } from '@/components/pay-data/PayDataFrame'
import { GroupTable } from '@/components/pay-data/PayTables'
import { loadPayData } from '@/lib/pay-data/load'
import { dateText, num, signedPct, usd } from '@/lib/pay-data/text'
import { pageMetadata } from '@/lib/seo/keywords'

export const revalidate = 21600
const PATH = `${PAY_DATA}/size`
export const metadata: Metadata = pageMetadata(PATH)

export default async function PaySizePage() {
  const d = await loadPayData()
  if (!d) return <PayDataPending path={PATH} title="Pay by employer size" />
  const rows = d.bySize
  const withGap = rows.filter((g) => g.likePct !== undefined)
  const best = [...withGap].sort((a, b) => b.likePct! - a.likePct!)[0]
  const worst = [...withGap].sort((a, b) => a.likePct! - b.likePct!)[0]
  const sized = Math.round(d.coverage.sizedShare * 100)
  const faq = [
    {
      q: 'Do bigger companies pay more?',
      a: best && worst
        ? `Not in a straight line. Matched on function, level and industry, advertised pay is highest at employers of ${best.label.replace(' employees', '')} employees (${signedPct(best.likePct!)}) and lowest at ${worst.label.replace(' employees', '').toLowerCase()} (${signedPct(worst.likePct!)}) against other employers. Raw medians differ more, because larger employers hold more senior roles.`
        : 'The matched comparison publishes with the next daily run.',
    },
    { q: 'How do you know how big an employer is?', a: `From the employer's profile, a curated list of large employers, and, where neither exists, an estimate by an AI model from public information. About ${sized}% of the postings counted here belong to an employer with a size we could place; the rest are left out of this table, not guessed. Sizes can be off by one band.` },
    { q: 'Is a small employer’s posted pay reliable?', a: 'Each band shows its postings and employers. A band needs 30 postings from 8 employers to appear, so a small number of employers can still shape it. Treat the smallest bands as a rough guide.' },
  ]
  return (
    <PayDataFrame
      path={PATH}
      trail={[{ name: 'Pay data', path: PAY_DATA }, { name: 'Pay by employer size', path: PATH }]}
      title="Salary by company size: do bigger employers pay more?"
      intro={`Advertised pay by employer headcount, from ${num(Math.round(d.overall.n * d.coverage.sizedShare))} postings whose employer's size we could place, with the gap against other employers once function, level and industry are matched. As of ${dateText(d.computedAt)}.`}
      asOf={d.computedAt}
      datasetName="Advertised pay in U.S. professional job postings, by employer size"
      datasetDescription="Median, quartiles, sample sizes and the like-for-like pay gap for each employer headcount band, 1 to 10 employees up to more than 100,000."
      faq={faq}
      csv={`${PAY_DATA}/data.csv`}
    >
      <Section id="table" title="Pay by employer headcount" note={`Employer sizes are partly estimated (about ${sized}% of paid postings have one). Bands with fewer than 30 postings or 8 employers are left out.`}>
        <GroupTable caption="Advertised pay by employer size" rows={rows} />
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground">Median for all paid postings, any employer size: {usd(d.overall.p50)}.</p>
      </Section>
    </PayDataFrame>
  )
}
