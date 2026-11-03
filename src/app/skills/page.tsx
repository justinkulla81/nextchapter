import type { Metadata } from 'next'
import Link from 'next/link'
import { Chips, JoinBand, LINK, Section, TopicShell } from '@/components/topics/blocks'
import { SkillTable } from '@/components/skills/SkillTable'
import { pageMetadata } from '@/lib/seo/keywords'
import { SITE_URL } from '@/lib/seo/facts'
import { loadSkillsMarket } from '@/lib/skills/market-server'
import { aiComplementSkills, dimensionValues, fmtPct, hotSkills, skillsByExposure, topSkills, SKILL_EXPOSURE_WHY, DIMENSIONS, type SkillDimension } from '@/lib/skills/market'

export const revalidate = 21600 // 6 hours: the snapshot is daily, and every regeneration is a billed ISR write

const TITLE = 'Skills employers ask for most, by industry, function, state and seniority'

export const metadata: Metadata = pageMetadata('/skills')

const LIST_SIZE = 15
const CHIPS_PER_DIMENSION = 14

export default async function SkillsPage() {
  const m = await loadSkillsMarket()
  const asOf = m ? new Date(m.asOf).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : null
  const path = '/skills'

  if (!m) {
    return (
      <TopicShell trail={[{ name: 'Skills', path }]} title={TITLE} intro="The skills list is being built from the open jobs on the board. Check back tomorrow.">
        <p className="mt-8 text-sm text-muted-foreground">
          In the meantime, see <Link href="/ai-skills" className={LINK}>which AI skills employers ask for</Link>.
        </p>
      </TopicShell>
    )
  }

  const top = topSkills(m, 25)
  const hot = hotSkills(m, LIST_SIZE)
  const exposed = skillsByExposure(m, 'most', 10)
  const resilient = skillsByExposure(m, 'least', 10)
  const withAi = aiComplementSkills(m, 10)

  return (
    <TopicShell
      trail={[{ name: 'Skills', path }]}
      title={TITLE}
      intro={`${m.withSkills.toLocaleString('en-US')} open jobs on the board name at least one skill. Here is what they ask for, as of ${asOf}.`}
      jsonLd={[{ '@context': 'https://schema.org', '@type': 'WebPage', name: TITLE, url: `${SITE_URL}${path}`, dateModified: m.asOf.slice(0, 10) }]}
    >
      <Section id="most-asked" title="Skills named in the most jobs" note="Share of open jobs that name the skill. A skill is counted once per job, from the job's full text.">
        <SkillTable caption="Skills named in the most open jobs" valueHeading="Share of jobs" extraHeading="Open jobs" rows={top.map((s) => ({ slug: s.slug, name: s.name, value: fmtPct(s.share), extra: s.n.toLocaleString('en-US') }))} />
      </Section>

      <Section id="browse" title="See the list for your own corner of the market" note="Every list links to the others: open an industry, function, state or seniority level, then any skill in it.">
        <div className="space-y-5">
          {DIMENSIONS.map((d) => {
            const values = dimensionValues(m, d.key as SkillDimension).slice(0, CHIPS_PER_DIMENSION)
            return (
              <div key={d.key}>
                <h3 className="text-sm font-semibold text-navy">By {d.label.toLowerCase()}</h3>
                <div className="mt-2">
                  <Chips kind={`skills_by_${d.key}`} event="skills_browse_clicked" items={values.map((v) => ({ href: `/skills/by/${d.key}/${v.key}`, label: v.label, detail: v.total.toLocaleString('en-US') }))} />
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      <Section id="rising" title="Rising skills" note="Skills named more often in jobs posted in the last 30 days than across all open jobs. The figure is how many times as common they are in new jobs.">
        {hot.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not enough recently posted jobs to say yet.</p>
        ) : (
          <SkillTable caption="Rising skills" valueHeading="In new jobs vs. all jobs" extraHeading="Share of new jobs" rows={hot.map((s) => ({ slug: s.slug, name: s.name, value: `${s.lift.toFixed(2)}×`, extra: fmtPct(s.freshShare) }))} />
        )}
      </Section>

      <Section id="ai" title="Skills and AI" note={SKILL_EXPOSURE_WHY}>
        <div className="grid gap-6 lg:grid-cols-3">
          <div>
            <h3 className="text-sm font-semibold text-navy">Most AI use seen in the work</h3>
            <SkillTable caption="Skills with the most observed AI use" valueHeading="Exposure" rows={exposed.map((s) => ({ slug: s.slug, name: s.name, value: s.exposure.toFixed(2) }))} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-navy">Least AI use seen so far</h3>
            <SkillTable caption="Skills with the least observed AI use" valueHeading="Exposure" rows={resilient.map((s) => ({ slug: s.slug, name: s.name, value: s.exposure.toFixed(2) }))} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-navy">Asked for alongside an AI skill</h3>
            <SkillTable caption="Skills most often named together with an AI skill" valueHeading="Jobs that also ask for AI" rows={withAi.map((s) => ({ slug: s.slug, name: s.name, value: fmtPct(s.aiShare) }))} />
          </div>
        </div>
        <p className="mt-4 text-sm">
          <Link href="/ai-skills" className={LINK}>Which AI skills employers ask for, and what they pay</Link>
        </p>
      </Section>

      <JoinBand source="skills-hub" what="which of these skills you are missing" />
      <p className="mt-6 text-xs text-muted-foreground">
        {m.withSkills.toLocaleString('en-US')} of {m.live.toLocaleString('en-US')} open jobs name a skill from our fixed list; jobs that name none are not counted, so shares are of jobs that name skills. Exposure is from the{' '}
        <a href="https://www.anthropic.com/research/labor-market-impacts" className={LINK}>Anthropic Economic Index</a>.
      </p>
    </TopicShell>
  )
}
