import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Chips, FactGrid, JobList, JoinBand, LINK, RankList, Section, TopicShell } from '@/components/topics/blocks'
import { FitCheck } from '@/components/capture/FitCheck'
import { captureSource } from '@/lib/capture/page-capture'
import { functionImage } from '@/lib/seo/topic-images'
import { loadTitleInsights } from '@/lib/seo/title-insights'
import { canonical } from '@/lib/seo/canonical'
import { SITE_URL } from '@/lib/seo/facts'
import { getTitleDetail, getTitlePlaceIndex, hasSalaryPage } from '@/lib/seo/job-titles'
import { usd } from '@/lib/seo/job-title-rules'
import { titleJobsSeo } from '@/lib/seo/templates'
import { titleMeta } from '@/lib/seo/title'

export const revalidate = 86400
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const d = await getTitleDetail(slug)
  if (!d) return { title: 'Jobs not found', robots: { index: false, follow: true } }
  const seo = titleJobsSeo(d.stat.name, d.stat.jobs)
  return { title: titleMeta(seo.title), description: seo.description, ...canonical(`/jobs/title/${slug}`) }
}

export default async function TitleJobsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const d = await getTitleDetail(slug)
  if (!d) {
    // A title with too few open jobs has no page; send the visitor to a search for it instead of a 404.
    if (!/^[a-z0-9-]{3,80}$/.test(slug)) notFound()
    redirect(`/jobs?q=${encodeURIComponent(slug.replace(/-/g, ' '))}`)
  }
  const { stat } = d
  const path = `/jobs/title/${slug}`
  // The cities and states with a page of their own for this title (job-title-places.ts), biggest first.
  const places = (await getTitlePlaceIndex()).filter((r) => r[0] === slug).sort((x, y) => y[3] - x[3]).slice(0, 16)
  const seo = titleJobsSeo(stat.name, stat.jobs)
  const ins = await loadTitleInsights(stat.name, stat.fn)
  return (
    <TopicShell
      trail={[{ name: 'Jobs', path: '/jobs' }, { name: 'Jobs by title', path: '/jobs/title' }, { name: stat.name, path }]}
      title={seo.h1}
      hero={functionImage(ins.fnLabel)}
      capture={{ kind: 'title', slug, label: stat.name, save: { q: stat.name, loc: '' } }}
      intro={`Open ${stat.name.toLowerCase()} jobs taken from employers’ own career sites and checked to still be open.${hasSalaryPage(stat) ? ` Listings that state pay show a median of ${usd(stat.median!)} a year.` : ''}`}
      jsonLd={[
        {
          '@context': 'https://schema.org', '@type': 'CollectionPage', name: seo.h1, url: `${SITE_URL}${path}`,
          mainEntity: { '@type': 'ItemList', itemListElement: d.jobs.map((j, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/jobs/${j.id}`, name: `${j.title} at ${j.company}` })) },
        },
      ]}
    >
      <Section id="market" title={`The market for ${stat.name.toLowerCase()} work`} note="Every figure names its source. Skills and AI figures describe the whole function this title sits in, not this title alone.">
        <FactGrid
          facts={[
            { key: 'open', label: `Verified open ${stat.name.toLowerCase()} jobs`, value: stat.jobs.toLocaleString('en-US'), source: 'NextChapter, checked against employer career sites', period: 'last 7 days' },
            ...(hasSalaryPage(stat) ? [{ key: 'listed', label: 'Median pay in listings that state it', value: usd(stat.median!), source: 'NextChapter verified openings' }] : []),
            ...(ins.outlook ? [{ key: 'outlook', label: 'Employment outlook', value: ins.outlook.line, source: ins.outlook.source }] : []),
            ...(ins.outlook?.median ? [{ key: 'wage', label: 'National median pay, all levels', value: usd(ins.outlook.median), source: 'BLS OEWS', period: ins.outlook.data.wageYear ?? undefined }] : []),
            ...(ins.outlook?.openings ? [{ key: 'openings', label: 'Openings a year, replacement and growth', value: ins.outlook.openings.toLocaleString('en-US'), source: 'BLS Employment Projections' }] : []),
            ...(ins.exposure ? [{ key: 'ai', label: 'AI use at work', value: ins.exposure.sentence, source: 'Anthropic Economic Index' }] : []),
            ...(ins.stats && ins.fnLabel ? [{ key: 'aiskills', label: `${ins.fnLabel} openings that ask for AI skills`, value: `${ins.stats.aiSkillPct}%`, source: 'NextChapter verified openings' }] : []),
            ...(ins.stats && ins.fnLabel ? [{ key: 'remote', label: `${ins.fnLabel} openings that are remote`, value: `${ins.stats.remotePct}%`, source: 'NextChapter verified openings' }] : []),
          ]}
        />
        {ins.stats && ins.skills.length > 0 && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <RankList tone={2} title="Skills most often named in openings" items={ins.stats.skills.slice(0, 8).map((x) => ({ label: x.name, detail: `${Math.round((x.count / ins.stats!.sample) * 100)}%` }))} />
            <RankList tone={3} title="AI skills worth building for this work" items={ins.aiSkills.slice(0, 6).map((x) => ({ label: x.label }))} />
          </div>
        )}
        {ins.fnPath && <p className="mt-3 text-sm"><Link href={ins.fnPath} className={LINK}>More on {ins.fnLabel} roles</Link></p>}
      </Section>
      {ins.pivots.length > 0 && (
        <Section id="pivots" title={`Where ${stat.name.toLowerCase()} experience can go next`} note="Career moves the skills carry over to, closest fit first. Time is how long a move usually takes.">
          <ul className="grid gap-3 sm:grid-cols-2">
            {ins.pivots.map((p) => (
              <li key={p.to} className="rounded-xl border border-border border-t-4 border-t-brand bg-white p-4">
                <p className="font-semibold text-navy">{p.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{p.fit === 'close' ? 'Close fit' : p.fit === 'adjacent' ? 'Adjacent' : 'Stretch'} · {p.time}</p>
                <p className="mt-2 text-sm text-muted-foreground">{p.why}</p>
                {p.brings.length > 0 && <p className="mt-2 text-xs text-navy">Carries over: {p.brings.join(', ')}</p>}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {ins.skills.length > 0 && <FitCheck label={stat.name} source={captureSource({ kind: 'title', slug })} skills={ins.skills} aiSkills={ins.aiSkills} />}
      <Section id="jobs" title={`Open ${stat.name.toLowerCase()} jobs`} note="Verified against the employer’s own career site within the last week.">
        <JobList jobs={d.jobs} total={stat.jobs} source={`title:${slug}`} />
        <p className="mt-3 text-sm"><Link href={`/jobs?q=${encodeURIComponent(stat.name)}`} className={LINK}>Search all {stat.name.toLowerCase()} jobs</Link></p>
      </Section>
      {hasSalaryPage(stat) && (
        <Section id="pay" title={`${stat.name} salary`}>
          <p className="max-w-3xl text-sm text-muted-foreground">
            The middle half of {stat.name.toLowerCase()} listings that state pay run from {usd(stat.p25!)} to {usd(stat.p75!)}. <Link href={`/salaries/${slug}`} className={LINK}>See the full {stat.name.toLowerCase()} salary breakdown</Link>.
          </p>
        </Section>
      )}
      {d.states.length > 0 && (
        <Section id="states" title={`Where ${stat.name.toLowerCase()} jobs are`}>
          <Chips kind="title_to_state" event="topic_link_clicked" items={d.states.map((s) => ({ href: `/places/${s.slug}`, label: s.name, detail: s.jobs.toLocaleString('en-US') }))} />
        </Section>
      )}
      {places.length > 0 && (
        <Section id="places" title={`${stat.name} jobs by city and state`}>
          <Chips kind="title_to_place" event="topic_link_clicked" items={places.map(([, key, , jobs, name]) => ({ href: `/jobs/title/${slug}/${key}`, label: name, detail: jobs.toLocaleString('en-US') }))} />
        </Section>
      )}
      {d.employers.length > 0 && (
        <Section id="employers" title={`Employers hiring ${stat.name.toLowerCase()}s`}>
          <ul className="flex flex-wrap gap-2 text-sm">
            {d.employers.map((e) => <li key={e.name} className="rounded-full border border-border bg-white px-3 py-1.5 text-navy">{e.name} <span className="tabular-nums text-muted-foreground">{e.jobs}</span></li>)}
          </ul>
        </Section>
      )}
      {d.related.length > 0 && (
        <Section id="related" title="Related job titles">
          <Chips kind="title_to_title" event="topic_link_clicked" items={d.related.map((t) => ({ href: `/jobs/title/${t.slug}`, label: t.name, detail: t.jobs.toLocaleString('en-US') }))} />
        </Section>
      )}
      <JoinBand source={`title:${slug}`} what={`how the market reads your background for ${stat.name.toLowerCase()} roles`} />
    </TopicShell>
  )
}
