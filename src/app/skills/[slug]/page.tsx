import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Chips, JoinBand, LINK, Section, TopicShell } from '@/components/topics/blocks'
import { WatchSkillButton } from '@/components/skills/WatchSkillButton'
import { ClaimSkills } from '@/components/skills/ClaimSkills'
import { canonical } from '@/lib/seo/canonical'
import { SITE_URL } from '@/lib/seo/facts'
import { fitDescription } from '@/lib/seo/templates'
import { titleMeta } from '@/lib/seo/title'
import { BAND_LABEL, bandOf } from '@/lib/skills/ai-exposure'
import { loadSkillsMarket } from '@/lib/skills/market-server'
import { DIMENSIONS, findSkill, fmtPct, hotSkills, pct, payPremium, placesForSkill, SKILL_EXPOSURE_WHY, topSkills } from '@/lib/skills/market'
import { coursesForSkill, programsForJobs } from '@/lib/skills/learn-server'
import { TrackedLink } from '@/components/marketing/TrackedLink'

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
  // Pay and the jobs that name the skill come from the daily snapshot (absent in a snapshot made before they were added: the sections are left out).
  const premium = payPremium(s, m.payBaseline)
  const jobs = s.jobs ?? []
  const [courses, programs] = await Promise.all([coursesForSkill(s.name).catch(() => []), programsForJobs(jobs.map((j) => j.soc)).catch(() => [])])
  const usd = (n: number) => `$${Math.round(n / 1000).toLocaleString('en-US')}k`
  const dollars = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`

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
        <div className="mt-5">
          <ClaimSkills skills={[{ slug: s.slug, name: s.name }]} source="skill_page" layout="buttons" />
          <p className="mt-2 text-xs text-muted-foreground">Add it to your profile. We use it to match you to jobs and to plan what to learn next.</p>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <WatchSkillButton slug={s.slug} name={s.name} source="skill_page" />
          <Link href={`/jobs?q=${encodeURIComponent(s.name)}`} className={`text-sm ${LINK}`}>
            See open jobs that name {s.name}
          </Link>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Watching a skill adds it to your member home, so you see new jobs that ask for it. Nothing is sent to your email.</p>
      </Section>

      {premium && (
        <Section
          id="pay"
          title={`What ${s.name} jobs pay`}
          note="Posted pay ranges only, and most jobs do not state one. Skills cluster in particular kinds of job, so part of any gap is the job and not the skill. This compares postings; it does not say that learning a skill raises your pay."
        >
          <p className="max-w-3xl text-sm">
            The median posted yearly pay (the middle of each range) is <strong className="text-navy">{usd(premium.median)}</strong> across {premium.n.toLocaleString('en-US')} jobs that name {s.name} and state a range. For all jobs that name a skill it is {usd(premium.baseline)}, so {s.name} jobs post {fmtPct(Math.abs(premium.pct) * 100)} {premium.pct >= 0 ? 'more' : 'less'}.
          </p>
        </Section>
      )}

      {jobs.length > 0 && (
        <Section id="jobs" title={`Jobs that name ${s.name} most`} note="Live postings counted by occupation, with the median posted yearly pay where at least 30 of them state one.">
          <ul className="grid max-w-3xl gap-2">
            {jobs.map((j) => (
              <li key={j.soc} className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl bg-white p-3 text-sm">
                <span className="font-medium text-navy">{j.title}</span>
                <span className="text-muted-foreground">
                  {j.n.toLocaleString('en-US')} jobs{j.median !== null ? ` · median ${usd(j.median)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

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

      {(courses.length > 0 || programs.length > 0) && (
        <Section id="learn" title={`Learn ${s.name}`} note="Courses on our list that name the skill, and state-approved training that prepares for the jobs above. Our state training list covers Texas only for now.">
          {courses.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-navy">Courses</h3>
              <ul className="mt-2 grid max-w-3xl gap-2">
                {courses.map((c) => (
                  <li key={c.id} className="rounded-xl bg-white p-3 text-sm">
                    <TrackedLink href={c.url} event="skill_course_clicked" properties={{ skillSlug: s.slug, courseId: c.id, provider: c.provider }} className={`font-medium ${LINK}`} rel="nofollow noopener">
                      {c.title}
                    </TrackedLink>
                    <span className="block text-xs text-muted-foreground">{[c.sponsor, c.level, c.free ? 'Free' : null].filter(Boolean).join(' · ')}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {programs.length > 0 && (
            <div className={courses.length > 0 ? 'mt-6' : ''}>
              <h3 className="text-sm font-semibold text-navy">State-approved training programs</h3>
              <ul className="mt-2 grid max-w-3xl gap-2">
                {programs.map((p) => (
                  <li key={p.id} className="rounded-xl bg-white p-3 text-sm">
                    {p.url && p.url.startsWith('http') ? (
                      <TrackedLink href={p.url} event="skill_program_clicked" properties={{ skillSlug: s.slug, programId: p.id, state: p.state }} className={`font-medium ${LINK}`} rel="nofollow noopener">
                        {p.program}
                      </TrackedLink>
                    ) : (
                      <span className="font-medium text-navy">{p.program}</span>
                    )}
                    <span className="block text-xs text-muted-foreground">
                      {[p.provider, p.state, p.credential, p.costUsd !== null ? dollars(p.costUsd) : null, p.weeks ? `${p.weeks} weeks` : null].filter(Boolean).join(' · ')}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                Looking at a degree? <Link href="/higher-education" className={LINK}>See what colleges on NextChapter offer</Link>.
              </p>
            </div>
          )}
        </Section>
      )}

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
