import { TrackedLink } from '@/components/marketing/TrackedLink'
import { getTitleIndex, hasSalaryPage } from '@/lib/seo/job-titles'
import { GENERIC_TITLES, annualPay, baseTitle, comparePay, titleSlug, usd } from '@/lib/seo/job-title-rules'

// On a public job page: the listing's pay set against what current listings for the same title state (the same numbers as
// /salaries/<title>). Without a stated pay the page still shows the title's range. Shows nothing when the title has no
// salary page. A failed read just leaves the block out.

export async function PayVsMarket({ jobId, title, salaryMin, salaryMax, payPeriod }: { jobId: string; title: string; salaryMin: number | null; salaryMax: number | null; payPeriod: string | null }) {
  const base = baseTitle(title)
  if (base.length < 6 || base.length > 60 || /[0-9]/.test(base) || GENERIC_TITLES.has(base)) return null
  const slug = titleSlug(base)
  const stat = (await getTitleIndex().catch(() => [])).find((t) => t.slug === slug)
  if (!stat || !hasSalaryPage(stat)) return null
  const { p25, median, p75 } = { p25: stat.p25!, median: stat.median!, p75: stat.p75! }
  const pay = annualPay(salaryMin, salaryMax, payPeriod)
  const { position, vsMedianPct } = comparePay(pay, p25, median, p75)
  const name = stat.name.toLowerCase()
  const listings = `${stat.payCount.toLocaleString('en-US')} open ${name} listings that state pay`
  const where =
    position === null ? null
    : position === 'within' ? `That is inside the middle half of those listings${vsMedianPct === 0 ? ' and at the median' : `, ${Math.abs(vsMedianPct!)}% ${vsMedianPct! > 0 ? 'above' : 'below'} the median`}.`
    : `That is ${Math.abs(vsMedianPct!)}% ${position} the median, ${position} the middle half of those listings.`
  const properties = { jobId, titleSlug: slug, position }

  return (
    <section aria-labelledby="pay-vs-market" className="mt-8 rounded-xl border border-border bg-white p-5">
      <h2 id="pay-vs-market" className="font-display text-xl font-semibold">Pay compared with the market</h2>
      <p className="mt-2 text-[15px] leading-relaxed">
        {pay != null
          ? <>This listing pays about {usd(pay)} a year. Across {listings}, the middle half runs {usd(p25)} to {usd(p75)} and the median is {usd(median)}. {where}</>
          : <>This listing does not state pay. Across {listings}, the middle half runs {usd(p25)} to {usd(p75)} and the median is {usd(median)}.</>}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">Listed pay is what employers advertise, not what people are paid.</p>
      <p className="mt-3 text-sm">
        <TrackedLink href={`/salaries/${slug}`} event="job_page_salary_link_clicked" properties={properties} className="font-semibold text-brand underline underline-offset-4">
          {stat.name} salaries by state
        </TrackedLink>
        {' · '}
        <TrackedLink href="/tools/pay-check" event="job_page_pay_check_clicked" properties={properties} className="font-semibold text-brand underline underline-offset-4">
          Check your own pay
        </TrackedLink>
      </p>
    </section>
  )
}
