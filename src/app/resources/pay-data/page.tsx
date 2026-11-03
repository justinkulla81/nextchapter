import type { Metadata } from 'next'
import Link from 'next/link'
import { Chips, LINK, Section } from '@/components/topics/blocks'
import { PAY_CUTS, PAY_DATA, PayDataFrame, PayDataPending } from '@/components/pay-data/PayDataFrame'
import { GroupTable, SkillTable } from '@/components/pay-data/PayTables'
import { loadPayData } from '@/lib/pay-data/load'
import { functionPayPath, industryPayPath, skillPath } from '@/lib/pay-data/slugs'
import { dateText, num, rangeText, signedPct, skillName, usd } from '@/lib/pay-data/text'
import { pageMetadata } from '@/lib/seo/keywords'

export const revalidate = 21600
export const metadata: Metadata = pageMetadata(PAY_DATA)

export default async function PayDataPage() {
  const d = await loadPayData()
  if (!d) return <PayDataPending path={PAY_DATA} title="Pay data" />
  const topInd = d.byIndustry.slice(0, 3)
  const topSkill = d.skills.filter((s) => s.likePct !== undefined).slice(0, 3)
  const bigVsSmall = d.bySize.filter((g) => g.likePct !== undefined)
  const faq = [
    { q: 'What do U.S. professional jobs pay?', a: `Across ${num(d.overall.n)} live professional job postings from ${num(d.overall.companies)} employers that state pay, the median advertised pay is ${usd(d.overall.p50)} a year, and half fall between ${usd(d.overall.p25)} and ${usd(d.overall.p75)}.` },
    { q: 'Which industries pay the most?', a: topInd.length ? `By median advertised pay: ${topInd.map((g) => `${g.label} (${usd(g.p50)})`).join(', ')}. Raw medians reflect the mix of roles in each industry; the industry page also shows the gap with function and level matched.` : 'The industry table publishes with the next daily run.' },
    { q: 'Do larger employers pay more?', a: bigVsSmall.length ? `Not in a straight line. Matched on function, level and industry, advertised pay is ${bigVsSmall.map((g) => `${signedPct(g.likePct!)} at employers of ${g.label.replace(' employees', '')} employees`).join(', ')}. Employer sizes are partly estimated; see the size page.` : 'The size comparison publishes with the next daily run.' },
    { q: 'Which skills are linked to higher pay?', a: topSkill.length ? `Matched on function, level and industry, the largest gaps among skills with enough postings are ${topSkill.map((s) => `${skillName(s.skill)} (${signedPct(s.likePct!)})`).join(', ')}. A gap is a difference in advertised pay, not proof that learning the skill raises a salary.` : 'The skills table publishes with the next daily run.' },
    { q: 'Does hiring growth change what an employer pays?', a: 'We show pay by how many jobs an employer has open now, and we store a monthly count of every employer’s openings so growth can be measured. Growth figures publish once several months have built up; we do not estimate them before then.' },
  ]
  return (
    <PayDataFrame
      path={PAY_DATA}
      trail={[{ name: 'Resources', path: '/resources' }, { name: 'Pay data', path: PAY_DATA }]}
      title="Pay data: what U.S. professional jobs advertise, and which skills pay more"
      intro={`Advertised pay on ${num(d.overall.n)} live professional postings from ${num(d.overall.companies)} employers: median ${usd(d.overall.p50)}, middle half ${usd(d.overall.p25)} to ${usd(d.overall.p75)}. Cut by industry, function, level, employer size and hiring volume, with the skills that go with higher pay.`}
      asOf={d.computedAt}
      datasetName="Pay in U.S. professional job postings, by industry, function, level, employer size and skill"
      datasetDescription="Employer-advertised pay on live U.S. professional job postings, by industry, function, level, employer size and hiring volume, and the skills linked to higher pay, with like-for-like gaps and sample sizes."
      faq={faq}
      csv={`${PAY_DATA}/data.csv`}
    >
      <Section id="cuts" title="Explore the data" note={`${num(d.overall.n)} paid postings, as of ${dateText(d.computedAt)}.`}>
        <Chips kind="pay_data_hub" event="topic_link_clicked" items={PAY_CUTS.map((c) => ({ href: c.href, label: c.label }))} />
      </Section>
      <Section id="levels" title="Pay by level" note="The median rises with seniority; this is the raw advertised pay, not matched on anything.">
        <GroupTable caption="Advertised pay by level" rows={d.byLevel} gapHeading="Gap" />
      </Section>
      <Section id="industry" title="Pay by industry" note="Sorted by median. Open an industry for its pay by level.">
        <GroupTable caption="Advertised pay by industry" rows={d.byIndustry.slice(0, 8)} href={(g) => industryPayPath(g.key)} />
        <p className="mt-3 text-sm"><Link href={`${PAY_DATA}/industry`} className={LINK}>All {d.byIndustry.length} industries</Link></p>
      </Section>
      <Section id="function" title="Pay by function" note="The role family, from Product to Administration.">
        <GroupTable caption="Advertised pay by function" rows={d.byFunction.slice(0, 8)} href={(g) => functionPayPath(g.label)} />
        <p className="mt-3 text-sm"><Link href={`${PAY_DATA}/function`} className={LINK}>All {d.byFunction.length} functions</Link></p>
      </Section>
      <Section id="skills" title="Skills linked to higher pay" note="Ordered by the gap with function, level and industry matched. Employers listing a skill on too few postings are left out.">
        <SkillTable caption="Skills ordered by like-for-like pay gap" rows={d.skills.slice(0, 10)} href={skillPath} />
        <p className="mt-3 text-sm"><Link href={`${PAY_DATA}/skills`} className={LINK}>All {d.skills.length} skills, and the highest-paying by overall salary</Link></p>
      </Section>
      <Section id="whole" title="The whole market in one line">
        <p className="max-w-3xl text-base leading-relaxed text-navy">{rangeText(d.overall)}. Postings counted: live, employer-posted pay, annual equivalent between $20,000 and $1,500,000. The hourly, daily and monthly rates are annualized.</p>
      </Section>
    </PayDataFrame>
  )
}
