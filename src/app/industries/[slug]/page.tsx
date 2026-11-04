import { fitDescription } from '@/lib/seo/templates'
import { FeedLine } from '@/components/seo/FeedLine'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { IndustryPaySection } from '@/components/pay-data/PayDataLinks'
import { FactGrid, RankList, Chips, ConferenceList, JobList, Section, TopicShell, functionChip, LINK } from '@/components/topics/blocks'
import { canonical } from '@/lib/seo/canonical'
import { SITE_URL } from '@/lib/seo/facts'
import { associationPath, INDUSTRIES } from '@/lib/seo/topics'
import { loadIndustry } from '@/lib/seo/topic-load'
import { stateCountsForIndustry } from '@/lib/seo/layoff-industry-links'
import { titleMeta } from '@/lib/seo/title'
import { industryImage } from '@/lib/seo/topic-images'
import { FitCheck } from '@/components/capture/FitCheck'
import { YourState } from '@/components/capture/YourState'
import { captureSource } from '@/lib/capture/page-capture'
import { AI_SKILL_ITEMS } from '@/lib/skills/ai-skills'
import { RankingContext } from '@/components/rankings/RankingContext'

export const revalidate = 21600 // 6 hours: was hourly; every regeneration is a billed ISR write
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const d = await loadIndustry(slug)
  if (!d) return { title: 'Industry not found', robots: { index: false, follow: true } }
  return {
    title: titleMeta(`${d.industry.name}: jobs, conferences and layoffs`),
    description: fitDescription(d.intro, 165),
    robots: { index: d.assessment.indexable, follow: true },
    ...canonical(`/industries/${slug}`),
  }
}

export default async function IndustryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const d = await loadIndustry(slug)
  if (!d) notFound()
  const { industry, jobs, stats, outlook, confs, orgs, facts, intro } = d
  const path = `/industries/${slug}`
  const layoffStates = await stateCountsForIndustry(industry.name).catch(() => [])
  return (
    <TopicShell
      trail={[{ name: 'Industries', path: '/industries' }, { name: industry.name, path }]}
      title={`${industry.name}: jobs, conferences and layoffs`}
      hero={industryImage(slug)}
      capture={{ kind: 'industry', slug, label: industry.name, save: { q: industry.name, loc: '' } }}
      intro={intro}
      network={{ key: `industry:${slug}`, kind: 'industry', name: industry.name, spelled: industry.name }}
      jsonLd={[
        {
          '@context': 'https://schema.org', '@type': 'CollectionPage', name: `${industry.name}: jobs, conferences and layoffs`, url: `${SITE_URL}${path}`,
          mainEntity: { '@type': 'ItemList', itemListElement: jobs.jobs.map((j, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/jobs/${j.id}`, name: `${j.title} at ${j.company}` })) },
        },
      ]}
    >
      <YourState label={industry.name} />
      <Section id="snapshot" title={`${industry.name} market snapshot`} note="Every figure names its source and period. Estimates are labeled as estimates.">
        <FactGrid facts={facts} />
        {stats && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <RankList title="Skills most often named in openings" items={stats.skills.slice(0, 8).map((x) => ({ label: x.name, detail: `${Math.round((x.count / stats.sample) * 100)}%` }))} />
            <RankList title="States with the most openings" items={stats.states.map((x) => ({ label: x.state, detail: `${Math.round((x.count / stats.sample) * 100)}%` }))} />
          </div>
        )}
      </Section>
      <IndustryPaySection bucket={industry.name} />
      {outlook.label !== 'Not enough data' && (
        <Section id="outlook" title={`${industry.name} outlook: ${outlook.label}`} note="Built from public Bureau of Labor Statistics numbers, not from our own postings. It describes the industry nationally, not any one employer.">
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {outlook.evidence.map((x) => <li key={x}>{x}</li>)}
          </ul>
        </Section>
      )}
      <RankingContext surface="industry" places={[{ name: industry.name, keys: [`industry:${industry.name}`] }]} />
      {industry.rule && (
        <Section id="jobs" title={`Open ${industry.name} jobs`} note="Verified against the employer’s own career site within the last week.">
          <JobList jobs={jobs.jobs} total={jobs.total} source={`industry:${slug}`} />
        </Section>
      )}
      {jobs.functions.length > 0 && (
        <Section id="functions" title="Functions hiring in this industry">
          <Chips kind="industry_to_function" event="topic_link_clicked" items={jobs.functions.map((f) => functionChip(f.name, f.count))} />
        </Section>
      )}
      {jobs.employers.length > 0 && (
        <Section id="employers" title="Employers hiring">
          <Chips kind="industry_to_employer" event="topic_link_clicked" items={jobs.employers.map((e) => ({ href: `/employers/${e.slug}`, label: e.name, detail: `${e.count.toLocaleString()} open` }))} />
        </Section>
      )}
      {stats && stats.skills.length > 0 && (
        <FitCheck
          label={industry.name}
          source={captureSource({ kind: 'industry', slug })}
          skills={stats.skills.slice(0, 10).map((x) => x.name)}
          aiSkills={AI_SKILL_ITEMS.filter((i) => i.group === 'applied').slice(0, 8).map((i) => ({ label: i.label, words: [i.label, ...i.aliases] }))}
        />
      )}
      <Section id="learn" title={`Learn and get funded for ${industry.name.toLowerCase()}`} note="Free to use. We point to the official page for each programme.">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {stats && stats.aiSkillPct > 0 && <li>{stats.aiSkillPct}% of these openings ask for AI skills. <Link href="/ai-skills" className={LINK}>See which AI skills each function needs</Link>.</li>}
          {stats && stats.skills.length > 0 && <li>The skills named most often: {stats.skills.slice(0, 5).map((x) => x.name).join(', ')}.</li>}
          <li><Link href="/funding" className={LINK}>Grants and funding for job seekers</Link>, ranked for your state and situation.</li>
          <li><Link href="/unemployment-benefits" className={LINK}>Unemployment benefits and severance rules</Link> by state, if you are between jobs.</li>
        </ul>
      </Section>
      <Section id="conferences" title={`${industry.name} conferences`} note="Dates, costs, calls for speakers and who runs each one.">
        <ConferenceList rows={confs.rows} total={confs.total} upcoming={confs.upcoming} source={`industry:${slug}`} />
      </Section>
      {orgs.length > 0 && (
        <Section id="associations" title="Industry associations and organizers">
          <Chips kind="industry_to_association" event="topic_link_clicked" items={orgs.map((o) => ({ href: associationPath(o), label: o }))} />
        </Section>
      )}
      {layoffStates.length > 0 && (
        <Section id="layoff-states" title={`${industry.name} layoffs by state`} note="WARN notices filed in the last 12 months.">
          <Chips kind="industry_to_state_layoffs" event="topic_link_clicked" items={layoffStates.map((x) => ({ href: x.href, label: `${x.name} (${x.notices})` }))} />
        </Section>
      )}
      <Section id="feed" title={`${industry.name} layoff notices by feed`}>
        <p className="text-sm"><FeedLine feed={`/feeds/industries/${slug}`} label={`Get new ${industry.name} layoff notices by RSS`} /></p>
      </Section>
      <Section id="more" title="Other industries">
        <Chips kind="industry_to_industry" event="topic_link_clicked" items={INDUSTRIES.filter((i) => i.slug !== slug).map((i) => ({ href: `/industries/${i.slug}`, label: i.name }))} />
      </Section>
    </TopicShell>
  )
}
