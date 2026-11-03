import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Chips, JoinBand, LINK, Section, TopicShell } from '@/components/topics/blocks'
import { WatchSkillButton } from '@/components/skills/WatchSkillButton'
import { canonical } from '@/lib/seo/canonical'
import { SITE_URL } from '@/lib/seo/facts'
import { fitDescription } from '@/lib/seo/templates'
import { titleMeta } from '@/lib/seo/title'
import { BAND_LABEL, bandOf } from '@/lib/skills/ai-exposure'
import { loadSkillsMarket } from '@/lib/skills/market-server'
import { DIMENSIONS, findSkill, fmtPct, hotSkills, pct, placesForSkill, SKILL_EXPOSURE_WHY, topSkills } from '@/lib/skills/market'

export const revalidate = 21600
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const m = await loadSkillsMarket()
  const s = m ? findSkill(m, slug) : null
  if (!s || !m) return { title: 'Skills', robots: { index: false, follow: true } }
  return {
    title: titleMeta(`${s.name}: jobs that ask for it, where, and how AI changes it`),
    description: fitDescription(`${s.name} is named in ${fmtPct(pct(s.n, m.withSkills))} of open jobs. See the industries, functions, states and seniority levels that ask for it most, and how much AI is used in the work.`, 165),
    ...canonical(`/skills/${slug}`),
  }
}

export default async function SkillPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const m = await loadSkillsMarket()
  const s = m ? findSkill(m, slug) : null
  // An unknown or too-small skill goes to the list, it does not 404.
  if (!m || !s) redirect('/skills')

  const path = `/skills/${slug}`
  const rank = [...m.skills].sort((a, b) => b.n - a.n).findIndex((x) => x.slug === slug) + 1
  const share = pct(s.n, m.withSkills)
  const hot = hotSkills(m, 200).find((x) => x.slug === slug)
  const band = s.exposure !== null && s.exposureN >= 200 ? bandOf(s.exposure) : null
  const aiShare = pct(s.aiPair, s.n)

  const facts: [string, string][] = [
    ['Open jobs that name it', s.n.toLocaleString('en-US')],
    ['Share of jobs', fmtPct(share)],
    ['Rank', `#${rank} of ${m.skills.length}`],
    ['Also ask for an AI skill', fmtPct(aiShare)],
  ]

  return (
    <TopicShell
      trail={[{ name: 'Skills', path: '/skills' }, { name: s.name, path }]}
      title={`${s.name}: jobs that ask for it, where, and how AI changes it`}
      intro={`${s.name} is named in ${s.n.toLocaleString('en-US')} open jobs, ${fmtPct(share)} of the jobs that name a skill.${hot ? ` It is ${hot.lift.toFixed(2)} times as common in jobs posted in the last 30 days.` : ''}`}
      jsonLd={[{ '@context': 'https://schema.org', '@type': 'WebPage', name: `${s.name} in job postings`, url: `${SITE_URL}${path}`, about: s.name, dateModified: m.asOf.slice(0, 10) }]}
    >
      <Section id="figures" title={`${s.name} in open jobs`} note="Counted once per job, from the job's full text.">
        <dl className="grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
          {facts.map(([k, v]) => (
            <div key={k} className="rounded-xl bg-white p-4">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="mt-1 text-xl font-bold tabular-nums text-navy">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <WatchSkillButton slug={s.slug} name={s.name} source="skill_page" />
          <Link href={`/jobs?q=${encodeURIComponent(s.name)}`} className={`text-sm ${LINK}`}>
            See open jobs that name {s.name}
          </Link>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Watching a skill adds it to your member home, so you see new jobs that ask for it. Nothing is sent to your email.</p>
      </Section>

      <Section id="where" title={`Where ${s.name} is asked for`} note="Biggest first. The percentage is the share of that group's jobs that name the skill.">
        <div className="grid gap-6 md:grid-cols-2">
          {DIMENSIONS.map((d) => {
            const places = placesForSkill(m, s, d.key)
            if (places.length === 0) return null
            return (
              <div key={d.key}>
                <h3 className="text-sm font-semibold text-navy">By {d.label.toLowerCase()}</h3>
                <div className="mt-2">
                  <Chips kind={`skill_${d.key}`} event="skills_browse_clicked" items={places.map((p) => ({ href: `/skills/by/${d.key}/${p.key}`, label: p.label, detail: fmtPct(p.share) }))} />
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      <Section id="ai" title={`${s.name} and AI`} note={SKILL_EXPOSURE_WHY}>
        {band && s.exposure !== null ? (
          <p className="text-sm">
            <strong className="text-navy">{BAND_LABEL[band]}.</strong> Mean observed exposure {s.exposure.toFixed(2)} across {s.exposureN.toLocaleString('en-US')} jobs with a matched occupation.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Too few jobs with a matched occupation to give an exposure figure for this skill.</p>
        )}
        <p className="mt-2 text-sm">
          {fmtPct(aiShare)} of the jobs that name {s.name} also name a specific AI skill.{' '}
          <Link href="/ai-skills" className={LINK}>Which AI skills employers ask for</Link>
        </p>
      </Section>

      <Section id="others" title="Other skills employers ask for">
        <Chips kind="skill_to_skill" event="skills_browse_clicked" items={topSkills(m, 14).filter((x) => x.slug !== slug).slice(0, 12).map((x) => ({ href: `/skills/${x.slug}`, label: x.name, detail: fmtPct(x.share) }))} />
      </Section>

      <JoinBand source={`skill:${slug}`} what={`whether your résumé shows ${s.name}`} />
    </TopicShell>
  )
}
