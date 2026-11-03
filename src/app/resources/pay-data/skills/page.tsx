import type { Metadata } from 'next'
import Link from 'next/link'
import { Chips, LINK, Section } from '@/components/topics/blocks'
import { PAY_DATA, PayDataFrame, PayDataPending } from '@/components/pay-data/PayDataFrame'
import { SkillTable } from '@/components/pay-data/PayTables'
import { paysLess, paysMore } from '@/lib/pay-data/assemble'
import { loadPayData } from '@/lib/pay-data/load'
import { skillPath } from '@/lib/pay-data/slugs'
import { dateText, num, signedPct, skillName, usd } from '@/lib/pay-data/text'
import { pageMetadata } from '@/lib/seo/keywords'

export const revalidate = 21600
const PATH = `${PAY_DATA}/skills`
export const metadata: Metadata = pageMetadata(PATH)

export default async function PaySkillsPage() {
  const d = await loadPayData()
  if (!d) return <PayDataPending path={PATH} title="Skills that pay more" />
  const more = d.skills.filter(paysMore).slice(0, 25)
  const byPay = [...d.skills].sort((a, b) => b.p50 - a.p50).slice(0, 25)
  const less = d.skills.filter(paysLess).sort((a, b) => a.likePct! - b.likePct!).slice(0, 12)
  const az = [...d.skills].sort((a, b) => a.skill.localeCompare(b.skill))
  const faq = [
    { q: 'Which skills are linked to the highest pay?', a: `Two answers. By overall salary, the postings that list ${byPay.slice(0, 3).map((s) => skillName(s.skill)).join(', ')} advertise the highest medians (${byPay.slice(0, 3).map((s) => usd(s.p50)).join(', ')}). By the gap with function, level and industry matched, the largest are ${more.slice(0, 3).map((s) => `${skillName(s.skill)} (${signedPct(s.likePct!)})`).join(', ')}.` },
    { q: 'What is the difference between overall salary and a skill’s pay gap?', a: 'Overall salary is the median pay of postings that list the skill, which mixes in the seniority and field of the roles that list it. The gap with the job mix matched compares those postings with similar postings (same function, level and industry) that do not list it, so it isolates what is left.' },
    { q: 'Does learning one of these skills raise my salary?', a: 'This data cannot say. It compares advertised pay between postings. Employers that ask for a skill may pay more for other reasons, and a posting lists skills the role needs, not what a person earns after learning one.' },
    { q: 'Do AI skills pay more?', a: 'Postings that name a specific AI skill advertise more than similar postings that never mention AI; see the AI skills salary premium page for the figure by function.' },
  ]
  return (
    <PayDataFrame
      path={PATH}
      trail={[{ name: 'Pay data', path: PAY_DATA }, { name: 'Skills and pay', path: PATH }]}
      title="Skills that pay more: which skills go with higher salaries"
      intro={`${d.skills.length} skills listed on at least 100 paid postings from 15 employers, ranked two ways: by the overall salary of postings that list them, and by the gap with function, level and industry matched. ${num(d.coverage.paidWithSkills)} paid postings with skills, as of ${dateText(d.computedAt)}.`}
      asOf={d.computedAt}
      datasetName="Skills and advertised pay in U.S. professional job postings"
      datasetDescription="For each skill with enough postings and employers: median advertised pay of postings that list it, the raw gap, and the like-for-like gap matched on function, level and industry."
      faq={faq}
      csv={`${PAY_DATA}/skills.csv`}
      related={[{ href: '/resources/ai-skills-pay-premium', label: 'AI skills salary premium' }, { href: '/ai-skills', label: 'AI skills in job postings' }]}
    >
      <Section id="gap" title="Largest pay gap, job mix matched" note="Postings that list the skill against similar postings that do not (same function, level and industry). Only gaps of 2% or more are listed as higher.">
        <SkillTable caption="Skills ordered by like-for-like pay gap" rows={more} href={skillPath} />
      </Section>
      <Section id="salary" title="Highest overall salary" note="Median advertised pay of postings that list the skill. This mixes in the seniority and field of the roles that list it.">
        <SkillTable caption="Skills ordered by median pay of postings listing them" rows={byPay} href={skillPath} />
      </Section>
      {less.length > 0 && (
        <Section id="lower" title="Skills that go with lower pay than similar roles" note="The raw median can look high or low for these skills; matched on function, level and industry, postings that list them advertise less than similar postings that do not. Often they are tools used across many roles rather than a mark of a better-paid one.">
          <SkillTable caption="Skills with a negative like-for-like gap" rows={less} href={skillPath} />
        </Section>
      )}
      <Section id="all" title={`All ${az.length} skills, A to Z`}>
        <Chips kind="pay_data_skills_all" event="topic_link_clicked" items={az.map((s) => ({ href: skillPath(s), label: skillName(s.skill), detail: usd(s.p50) }))} />
        <p className="mt-4 text-sm"><Link href="/resources/ai-skills-pay-premium" className={LINK}>AI skills have their own page</Link>, with the premium by function.</p>
      </Section>
    </PayDataFrame>
  )
}
