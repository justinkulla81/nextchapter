import Link from 'next/link'
import { Chips, LINK, Section } from '@/components/topics/blocks'
import { PAY_CUTS, PAY_DATA } from '@/components/pay-data/PayDataFrame'
import { loadPayData } from '@/lib/pay-data/load'
import { findGroup, functionPayPath, industryPayPath } from '@/lib/pay-data/slugs'
import { num, usd } from '@/lib/pay-data/text'
import { CRAWLER_INDUSTRY_BUCKET } from '@/lib/seo/topics'
import { skillSlug } from '@/lib/pay-data/assemble'

// The links from the rest of the site into the pay data, so each page that touches pay, an industry, a function or a skill points at the
// matching pay page. The server ones read the stored figure (one primary-key read, shared within a render) and render nothing until it exists,
// so a link never leads to a page that answers "not built yet".

/** The five cuts as chips, for pages about pay in general (salaries, top employers, the AI skills pages). */
export function PayCutsSection({ title = 'Pay by industry, function, employer size and skill', note }: { title?: string; note?: string }) {
  return (
    <Section id="pay-data" title={title} note={note ?? 'Advertised pay on live professional postings, with the gap once function, level and industry are matched.'}>
      <Chips kind="pay_data_cuts" event="topic_link_clicked" items={[{ href: PAY_DATA, label: 'Pay data overview' }, ...PAY_CUTS]} />
    </Section>
  )
}

/** On an industry page: what the industry's postings advertise, linking to its pay page. `bucket` is the page's industry bucket name. */
export async function IndustryPaySection({ bucket }: { bucket: string }) {
  const d = await loadPayData()
  if (!d) return null
  const codes = Object.entries(CRAWLER_INDUSTRY_BUCKET).filter(([, b]) => b === bucket).map(([c]) => c)
  const groups = d.byIndustry.filter((g) => codes.includes(g.key))
  if (!groups.length) return null
  return (
    <Section id="pay" title={`What ${bucket} pays`} note="Advertised pay on live postings that state it, annual in US dollars.">
      <ul className="max-w-3xl space-y-2 text-base text-navy">
        {groups.map((g) => (
          <li key={g.key}>
            <Link href={industryPayPath(g.key)} className={LINK}>{g.label}</Link>: median {usd(g.p50)}, middle half {usd(g.p25)} to {usd(g.p75)} ({num(g.n)} postings).
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm"><Link href={`${PAY_DATA}/industry`} className={LINK}>Compare all industries</Link></p>
    </Section>
  )
}

/** On a function page: the function's advertised pay and the skills that go with higher pay in it. */
export async function FunctionPaySection({ label }: { label: string }) {
  const d = await loadPayData()
  const g = d && findGroup(d.byFunction, skillSlug(label), 'function')
  if (!d || !g) return null
  return (
    <Section id="pay" title={`What ${g.label} jobs pay`} note="Advertised pay on live postings that state it, annual in US dollars.">
      <p className="max-w-3xl text-base text-navy">
        <Link href={functionPayPath(g.label)} className={LINK}>{g.label} pay</Link>: median {usd(g.p50)}, middle half {usd(g.p25)} to {usd(g.p75)}, from {num(g.n)} postings. See also the <Link href={`${PAY_DATA}/skills`} className={LINK}>skills that pay more</Link>.
      </p>
    </Section>
  )
}

/** On a job-title salary page: a single link to the title's function pay page, when there is one. */
export async function TitlePayLink({ fn }: { fn: string | null | undefined }) {
  const d = await loadPayData()
  const g = d && fn ? findGroup(d.byFunction, skillSlug(fn), 'function') : null
  if (!g) return null
  return (
    <p className="mt-6 max-w-3xl text-sm text-muted-foreground">
      More pay data: <Link href={functionPayPath(g.label)} className={LINK}>{g.label} pay by level</Link>, <Link href={`${PAY_DATA}/skills`} className={LINK}>skills that pay more</Link> and <Link href={`${PAY_DATA}/size`} className={LINK}>pay by employer size</Link>.
    </p>
  )
}
