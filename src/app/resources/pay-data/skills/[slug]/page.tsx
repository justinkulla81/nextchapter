import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Chips, Section } from '@/components/topics/blocks'
import { PAY_DATA, PayDataFrame, PayDataPending } from '@/components/pay-data/PayDataFrame'
import { paysLess, paysMore } from '@/lib/pay-data/assemble'
import { loadPayData } from '@/lib/pay-data/load'
import { findSkill, functionPayPath, skillPath } from '@/lib/pay-data/slugs'
import { k, num, rangeText, signedPct, skillDescription, skillName, skillSentence, usd } from '@/lib/pay-data/text'
import { AI_SKILL_ITEMS, aiSkillIdForLabel } from '@/lib/skills/ai-skills'
import { canonical } from '@/lib/seo/canonical'
import { functionPath } from '@/lib/seo/topics'
import { titleMeta } from '@/lib/seo/title'

export const revalidate = 21600
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

const isAiSkill = (skill: string) => !!aiSkillIdForLabel(skill) || AI_SKILL_ITEMS.some((i) => i.aliases?.includes(skill))

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const d = await loadPayData()
  const s = d && findSkill(d, slug)
  if (!s) return { title: 'Skill pay data', robots: { index: false, follow: true } }
  return { title: titleMeta(`${skillName(s.skill)} Salary: Median ${usd(s.p50)} in Postings`), description: skillDescription(s), ...canonical(skillPath(s)) }
}

export default async function SkillPayPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const d = await loadPayData()
  if (!d) return <PayDataPending path={`${PAY_DATA}/skills/${slug}`} title="Skill pay" />
  const s = findSkill(d, slug)
  if (!s) redirect(`${PAY_DATA}/skills`)
  const path = skillPath(s)
  const name = skillName(s.skill)
  const topFn = s.topFunctions[0]
  const sameFn = topFn ? (d.skillsByFunction[topFn.label] ?? []).filter((x) => x.skill !== s.skill).flatMap((x) => d.skills.filter((y) => y.skill === x.skill)).slice(0, 8) : []
  const ai = isAiSkill(s.skill)
  const faq = [
    { q: `How much do jobs that ask for ${name} pay?`, a: `${rangeText(s)}, from ${num(s.n)} paid postings from ${num(s.companies)} employers. Other postings that list skills advertise a median ${usd(s.baseP50)}.` },
    {
      q: `Does ${name} increase pay?`,
      a: s.likePct === undefined
        ? `Postings that list ${name} advertise ${signedPct(s.rawPct)} against other postings, but there are too few matching postings to compare like with like, so we do not state a matched figure.`
        : paysMore(s) ? `Matched on function, level and industry, postings that list ${name} advertise ${signedPct(s.likePct)} (about ${k(s.likeUsd!)} a year) more than similar postings that do not. That is a difference in advertised pay between postings, not proof that learning the skill raises a salary.`
        : paysLess(s) ? `Not by this measure. Matched on function, level and industry, postings that list ${name} advertise ${signedPct(s.likePct)} against similar postings that do not.`
        : `No clear gap. Matched on function, level and industry, postings that list ${name} advertise about the same as similar postings that do not.`,
    },
    ...(topFn ? [{ q: `Which jobs list ${name} most?`, a: `${s.topFunctions.map((f) => `${f.label} (${num(f.n)} postings)`).join(', ')}.` }] : []),
  ]
  const related = [
    ...s.topFunctions.map((f) => ({ href: functionPayPath(f.label), label: `${f.label} pay` })),
    ...(ai ? [{ href: '/resources/ai-skills-pay-premium', label: 'AI skills salary premium' }, { href: '/ai-skills', label: 'AI skills in job postings' }] : []),
    ...s.topFunctions.slice(0, 1).map((f) => ({ href: functionPath(f.label), label: `${f.label} jobs` })),
    { href: '/salaries', label: 'Salary by job title' },
    { href: '/tools/pay-check', label: 'Check your pay' },
  ]
  return (
    <PayDataFrame
      path={path}
      trail={[{ name: 'Pay data', path: PAY_DATA }, { name: 'Skills and pay', path: `${PAY_DATA}/skills` }, { name: name, path }]}
      title={`${name} salary: what jobs that ask for it advertise`}
      intro={skillSentence(s)}
      asOf={d.computedAt}
      datasetName={`Advertised pay in U.S. job postings that list ${name}`}
      datasetDescription={`Median, quartiles and the like-for-like gap for postings that list ${name}, with sample sizes.`}
      faq={faq}
      csv={`${PAY_DATA}/skills.csv`}
      related={related}
    >
      <Section id="range" title={`${name} pay range`} note={`From ${num(s.n)} paid postings from ${num(s.companies)} employers that list it. Annual, in US dollars.`}>
        <dl className="grid max-w-3xl grid-cols-2 gap-4 text-center sm:grid-cols-4">
          {([['Lower quarter', usd(s.p25)], ['Median', usd(s.p50)], ['Upper quarter', usd(s.p75)], ['Median without it', usd(s.baseP50)]] as const).map(([label, v]) => (
            <div key={label} className="rounded-xl border border-border bg-white p-5">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-1 text-xl font-bold tabular-nums text-navy">{v}</dd>
            </div>
          ))}
        </dl>
        <ul className="mt-4 max-w-3xl list-disc space-y-2 pl-5 text-base leading-relaxed text-navy">
          <li>Raw gap: {signedPct(s.rawPct)}. This includes the seniority and field of the roles that list the skill.</li>
          <li>
            {s.likePct !== undefined
              ? `Gap with function, level and industry matched: ${signedPct(s.likePct)} (about ${k(s.likeUsd!)} a year), across ${num(s.likeN!)} postings in ${s.likeCells} comparison cells.`
              : 'Gap with function, level and industry matched: not shown, because too few postings sit in cells that have both listing and non-listing postings.'}
          </li>
        </ul>
      </Section>
      {s.topFunctions.length > 0 && (
        <Section id="where" title={`Where ${name} is asked for`} note="The functions with the most postings that list it.">
          <Chips kind="pay_data_skill_functions" event="topic_link_clicked" items={s.topFunctions.map((f) => ({ href: functionPayPath(f.label), label: f.label, detail: `${num(f.n)} postings` }))} />
        </Section>
      )}
      {sameFn.length > 0 && (
        <Section id="related" title={`Other skills that pay well in ${topFn.label}`} note="Skills with the highest median pay in the same function.">
          <Chips kind="pay_data_related_skills" event="topic_link_clicked" items={sameFn.map((x) => ({ href: skillPath(x), label: skillName(x.skill), detail: usd(x.p50) }))} />
        </Section>
      )}
    </PayDataFrame>
  )
}
