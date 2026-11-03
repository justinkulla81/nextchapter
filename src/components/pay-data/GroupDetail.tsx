import Link from 'next/link'
import { Chips, LINK, Section } from '@/components/topics/blocks'
import { PAY_DATA, PayDataFrame } from '@/components/pay-data/PayDataFrame'
import { GroupTable, SkillTable } from '@/components/pay-data/PayTables'
import { PAY_LEVELS, PAY_LEVEL_LABEL, type PayData, type PayGroup } from '@/lib/pay-data/types'
import { functionPayPath, groupSlug, industryPayPath, skillPath } from '@/lib/pay-data/slugs'
import { gapPhrase, num, rangeText, sampleText, usd } from '@/lib/pay-data/text'
import { CRAWLER_INDUSTRY_BUCKET, functionPath, industryPath } from '@/lib/seo/topics'

/** The page for one industry or one function: its pay, pay by level, what to compare it with, and links to the rest of the site about it. */
export function GroupDetail({ d, g, cut }: { d: PayData; g: PayGroup; cut: 'industry' | 'function' }) {
  const groups = cut === 'industry' ? d.byIndustry : d.byFunction
  const noun = cut === 'industry' ? 'industry' : 'function'
  const path = `${PAY_DATA}/${cut}/${groupSlug(g, cut)}`
  const hrefOf = (x: PayGroup) => (cut === 'industry' ? industryPayPath(x.key) : functionPayPath(x.label))
  const rank = groups.findIndex((x) => x.key === g.key)
  const near = groups.slice(Math.max(0, rank - 3), rank + 4).filter((x) => x.key !== g.key)
  const levels = PAY_LEVELS.flatMap((l) => (g.levels?.[l] ? [{ key: l, label: PAY_LEVEL_LABEL[l], ...g.levels[l]! }] : []))
  const skills = cut === 'function' ? (d.skillsByFunction[g.label] ?? []).flatMap((s) => d.skills.filter((x) => x.skill === s.skill)) : []
  const gap = gapPhrase(g, cut === 'industry' ? 'other industries' : 'other functions')
  const vs = g.p50 >= d.overall.p50 ? 'above' : 'below'
  const name = `${g.label} jobs`
  const faq = [
    { q: `How much do ${g.label} jobs pay?`, a: `${rangeText(g)}, from ${sampleText(g)} that state pay. That is ${vs} the ${usd(d.overall.p50)} median for all professional postings. It is advertised pay, not what people are paid.` },
    ...(gap ? [{ q: `Is ${g.label} pay higher or lower once the job mix is matched?`, a: `With function, level and industry matched, advertised pay is ${gap}.` }] : []),
    ...(levels.length ? [{ q: `How does ${g.label} pay change with level?`, a: levels.map((l) => `${l.label}: ${usd(l.p50)}`).join('; ') + '.' }] : []),
  ]
  const related = [
    ...(cut === 'industry' && CRAWLER_INDUSTRY_BUCKET[g.key] ? [{ href: industryPath(CRAWLER_INDUSTRY_BUCKET[g.key]), label: `${g.label} jobs and employers` }] : []),
    ...(cut === 'function' ? [{ href: functionPath(g.label), label: `${g.label} jobs, pay and employers` }] : []),
    { href: '/salaries', label: 'Salary by job title' },
    { href: '/top-employers', label: 'Top employers' },
  ]
  return (
    <PayDataFrame
      path={path}
      trail={[{ name: 'Pay data', path: PAY_DATA }, { name: cut === 'industry' ? 'Pay by industry' : 'Pay by function', path: `${PAY_DATA}/${cut}` }, { name: g.label, path }]}
      title={`${g.label} salaries: what ${name.toLowerCase()} advertise`}
      intro={`${g.label} postings that state pay run ${usd(g.p25)} to ${usd(g.p75)} for the middle half, median ${usd(g.p50)}, from ${sampleText(g)}.${gap ? ` With function, level and industry matched, pay is ${gap}.` : ''}`}
      asOf={d.computedAt}
      datasetName={`Advertised pay in ${g.label} (${noun}) on U.S. professional job postings`}
      datasetDescription={`Median, quartiles and pay by level for ${g.label} ${noun} postings that state pay, with sample sizes.`}
      faq={faq}
      csv={`${PAY_DATA}/data.csv`}
      related={related}
    >
      <Section id="range" title={`${g.label} pay range`} note={`From ${sampleText(g)}. Annual, in US dollars.`}>
        <dl className="grid max-w-2xl grid-cols-3 gap-4 text-center">
          {([['Lower quarter', g.p25], ['Median', g.p50], ['Upper quarter', g.p75]] as const).map(([label, v]) => (
            <div key={label} className="rounded-xl border border-border bg-white p-5">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums text-navy">{usd(v)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-navy">
          The median for all professional postings is {usd(d.overall.p50)}, so {g.label} is {vs} it.{gap ? ` With function, level and industry matched, ${g.label} pay is ${gap}.` : ''}
        </p>
      </Section>
      {levels.length > 0 && (
        <Section id="levels" title={`${g.label} pay by level`} note="Levels with at least 30 paid postings from 8 employers.">
          <GroupTable caption={`${g.label} advertised pay by level`} rows={levels.map((l) => ({ key: l.key, label: l.label, n: l.n, companies: l.companies, p25: l.p25, p50: l.p50, p75: l.p75 }))} gapHeading="Gap" />
        </Section>
      )}
      {skills.length > 0 && (
        <Section id="skills" title={`Skills that go with higher ${g.label} pay`} note="Skills listed on 50 or more paid postings from 10 employers in this function, by median pay.">
          <SkillTable caption={`Skills in ${g.label} postings by median pay`} rows={skills} href={skillPath} />
        </Section>
      )}
      {near.length > 0 && (
        <Section id="compare" title={`Compare with other ${noun === 'industry' ? 'industries' : 'functions'}`} note="The groups ranked just above and below by median.">
          <Chips kind={`pay_data_${cut}_compare`} event="topic_link_clicked" items={near.map((x) => ({ href: hrefOf(x), label: x.label, detail: usd(x.p50) }))} />
          <p className="mt-3 text-sm"><Link href={`${PAY_DATA}/${cut}`} className={LINK}>All {groups.length} {noun === 'industry' ? 'industries' : 'functions'}</Link> · {num(g.n)} postings in this one</p>
        </Section>
      )}
    </PayDataFrame>
  )
}
