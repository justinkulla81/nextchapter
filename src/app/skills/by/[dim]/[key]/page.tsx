import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Chips, JoinBand, LINK, Section, TopicShell } from '@/components/topics/blocks'
import { SkillTable } from '@/components/skills/SkillTable'
import { canonical } from '@/lib/seo/canonical'
import { SITE_URL } from '@/lib/seo/facts'
import { fitDescription } from '@/lib/seo/templates'
import { titleMeta } from '@/lib/seo/title'
import { loadSkillsMarket } from '@/lib/skills/market-server'
import { DIMENSIONS, dimensionValues, fmtPct, skillsIn, type SkillDimension } from '@/lib/skills/market'

export const revalidate = 21600
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

const asDimension = (v: string): SkillDimension | null => (DIMENSIONS.some((d) => d.key === v) ? (v as SkillDimension) : null)

/** Reads the right way in a title: "in Healthcare", "in Texas", "at Director level", "in Finance". */
function phrase(dim: SkillDimension, label: string): string {
  return dim === 'level' ? `at the ${label.toLowerCase()} level` : `in ${label}`
}

export async function generateMetadata({ params }: { params: Promise<{ dim: string; key: string }> }): Promise<Metadata> {
  const { dim: d, key } = await params
  const dim = asDimension(d)
  const m = await loadSkillsMarket()
  const label = dim && m ? m.labels[dim]?.[key] : null
  if (!dim || !m || !label) return { title: 'Skills', robots: { index: false, follow: true } }
  return {
    title: titleMeta(`Skills employers ask for most ${phrase(dim, label)}`),
    description: fitDescription(`The skills named in the most open jobs ${phrase(dim, label)}, with how common each is and where else it is asked for.`, 165),
    ...canonical(`/skills/by/${dim}/${key}`),
  }
}

export default async function SkillsByPage({ params }: { params: Promise<{ dim: string; key: string }> }) {
  const { dim: d, key } = await params
  const dim = asDimension(d)
  const m = await loadSkillsMarket()
  const label = dim && m ? m.labels[dim]?.[key] : null
  if (!dim || !m || !label) redirect('/skills')

  const path = `/skills/by/${dim}/${key}`
  const base = m.totals[dim][key] ?? 0
  const rows = skillsIn(m, dim, key, 25)
  const meta = DIMENSIONS.find((x) => x.key === dim)!
  const others = dimensionValues(m, dim).filter((v) => v.key !== key).slice(0, 14)

  return (
    <TopicShell
      trail={[{ name: 'Skills', path: '/skills' }, { name: label, path }]}
      title={`Skills employers ask for most ${phrase(dim, label)}`}
      intro={`${base.toLocaleString('en-US')} open jobs ${phrase(dim, label)} name at least one skill. These are the skills they name most.`}
      jsonLd={[{ '@context': 'https://schema.org', '@type': 'WebPage', name: `Skills ${phrase(dim, label)}`, url: `${SITE_URL}${path}`, dateModified: m.asOf.slice(0, 10) }]}
    >
      <Section id="skills" title={`Most-asked skills ${phrase(dim, label)}`} note={`Share of the ${base.toLocaleString('en-US')} jobs ${phrase(dim, label)} that name the skill.`}>
        <SkillTable caption={`Skills named in the most jobs ${phrase(dim, label)}`} valueHeading="Share of jobs" extraHeading="Open jobs" rows={rows.map((s) => ({ slug: s.slug, name: s.name, value: fmtPct(s.share), extra: s.count.toLocaleString('en-US') }))} />
      </Section>

      <Section id="others" title={`Same list for other ${meta.plural}`}>
        <Chips kind={`skills_by_${dim}`} event="skills_browse_clicked" items={others.map((v) => ({ href: `/skills/by/${dim}/${v.key}`, label: v.label, detail: v.total.toLocaleString('en-US') }))} />
        <p className="mt-4 text-sm">
          <Link href="/skills" className={LINK}>All skills, and the lists by industry, function, state and seniority</Link>
        </p>
      </Section>

      <JoinBand source={`skills-by:${dim}:${key}`} what={`which of these skills you are missing ${phrase(dim, label)}`} />
    </TopicShell>
  )
}
