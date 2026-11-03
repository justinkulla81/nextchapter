import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Chips, FactGrid, JobList, JoinBand, LINK, RankList, Section, TopicShell } from '@/components/topics/blocks'
import { FitCheck } from '@/components/capture/FitCheck'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { PERSONALIZE_HREF } from '@/components/home/PersonalizePanel'
import { captureSource } from '@/lib/capture/page-capture'
import { canonical } from '@/lib/seo/canonical'
import { SITE_URL } from '@/lib/seo/facts'
import { usd } from '@/lib/seo/job-title-rules'
import { titleMeta } from '@/lib/seo/title'
import { loadTitleInsights } from '@/lib/seo/title-insights'
import { entryCategory, entryRole, similarRoles } from '@/lib/entry-roles/roles'
import { getEntryPlaceIndex, getEntryRoleLive, getEntryStats } from '@/lib/entry-roles/live'
import { experienceAnswer, faqJsonLd, occupationJsonLd, payAnswer, roleFaqs, roleLabel, roleLead, roleSeo, skillItems, type RoleFacts } from '@/lib/entry-roles/text'

// One page per entry-level white-collar role: what the job is, a day in it, the skills, the open jobs now, pay and outlook where
// we hold them, a résumé check against the skills, and the roles it leads to. The role text is curated (lib/entry-roles/roles.ts);
// the openings and figures come from the board-figures cron (lib/entry-roles/live.ts), never a scan on a page view.
export const revalidate = 86400
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

async function factsFor(slug: string): Promise<RoleFacts | null> {
  const s = (await getEntryStats()).find((x) => x.slug === slug)
  return s ? { jobs: s.jobs, noExperience: s.noExperience, training: s.training, median: s.median, p25: s.p25, p75: s.p75, payCount: s.payCount } : null
}

export async function generateMetadata({ params }: { params: Promise<{ role: string }> }): Promise<Metadata> {
  const { role: slug } = await params
  const role = entryRole(slug)
  if (!role) return { title: 'Entry-level jobs', robots: { index: false, follow: true } }
  const seo = roleSeo(role, await factsFor(slug))
  return { title: titleMeta(seo.title), description: seo.description, ...canonical(`/jobs/entry-level/${slug}`) }
}

export default async function EntryRolePage({ params }: { params: Promise<{ role: string }> }) {
  const { role: slug } = await params
  const role = entryRole(slug)
  if (!role) {
    if (!/^[a-z0-9-]{2,80}$/.test(slug)) notFound()
    redirect('/jobs/entry-level')
  }
  const path = `/jobs/entry-level/${slug}`
  const label = roleLabel(role)
  const lowerLabel = label.toLowerCase()
  const cat = entryCategory(role.cat)!
  const [facts, live, placeIndex] = await Promise.all([factsFor(slug), getEntryRoleLive(slug), getEntryPlaceIndex()])
  const ins = await loadTitleInsights(label, role.fn).catch(() => null)
  const seo = roleSeo(role, facts)
  const faqs = roleFaqs(role, facts)
  const cities = placeIndex.filter((r) => r[0] === slug).sort((a, b) => b[3] - a[3]).slice(0, 16)
  const similar = similarRoles(role, 8)
  const moves = role.next.map((s) => entryRole(s)).filter((x): x is NonNullable<typeof x> => !!x)
  const items = skillItems(role)
  const pay = payAnswer(role, facts)

  return (
    <TopicShell
      trail={[{ name: 'Jobs', path: '/jobs' }, { name: 'Entry-level jobs', path: '/jobs/entry-level' }, { name: label, path }]}
      title={seo.h1}
      intro={roleLead(role, facts)}
      capture={{ kind: 'title', slug: `entry-${slug}`, label, save: { q: label, loc: '' } }}
      jsonLd={[
        occupationJsonLd(role, path, facts),
        faqJsonLd(faqs),
        {
          '@context': 'https://schema.org', '@type': 'CollectionPage', name: seo.h1, url: `${SITE_URL}${path}`,
          about: { '@type': 'Occupation', name: label },
          ...(live ? { mainEntity: { '@type': 'ItemList', itemListElement: live.jobs.map((j, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/jobs/${j.id}`, name: `${j.title} at ${j.company}` })) } } : {}),
        },
      ]}
    >
      <Section id="what" title={`What a ${lowerLabel} does`} note={`In the ${cat.name.toLowerCase()} family of jobs. ${cat.blurb}`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <RankList tone={1} title="A typical day" items={role.tasks.map((t) => ({ label: t }))} />
          <div className="rounded-xl border border-border bg-white p-4">
            <p className="text-sm font-semibold text-navy">Do you need experience?</p>
            <p className="mt-2 text-sm text-muted-foreground">{experienceAnswer(role, facts)}</p>
          </div>
        </div>
      </Section>

      <Section id="jobs" title={`Open entry-level ${lowerLabel} jobs`} note="Taken from employers’ own career sites and checked to still be open within the last week.">
        {live && live.jobs.length > 0 ? (
          <>
            <JobList jobs={live.jobs} total={live.detail.jobs} source={`entry-role:${slug}`} />
            <p className="mt-3 text-sm">
              <Link href={`/jobs?q=${encodeURIComponent(label)}`} className={LINK}>Search all {lowerLabel} jobs</Link>
            </p>
          </>
        ) : (
          <p className="max-w-3xl text-sm text-muted-foreground">
            No entry-level {lowerLabel} jobs are open on the career sites we track right now. Save a search above and we will email you when one is posted, or <Link href={`/jobs?q=${encodeURIComponent(label)}`} className={LINK}>search all {lowerLabel} jobs</Link>, including ones that do not say entry level.
          </p>
        )}
      </Section>

      <Section id="skills" title={`Skills for ${lowerLabel} jobs`} note="The skills this job uses, most important first. Most can be learned or shown before the first day.">
        <div className="grid gap-4 sm:grid-cols-2">
          <RankList tone={2} title="Skills to build or show" items={role.skills.map((s) => ({ label: s }))} />
          <div className="rounded-xl border border-border bg-white p-4">
            <p className="text-sm font-semibold text-navy">Close the gap for this job</p>
            <p className="mt-2 text-sm text-muted-foreground">Tell us what you already do and we point you to the training for the skills you are missing. Or check your résumé below first.</p>
            <TrackedLink
              href={`${PERSONALIZE_HREF}&role=${slug}&goal=skills`}
              event="entry_role_training_clicked"
              properties={{ roleSlug: slug, category: role.cat, openJobs: facts?.jobs ?? 0 }}
              className="mt-3 inline-flex text-sm font-semibold text-brand underline underline-offset-4"
            >
              Find training for these skills
            </TrackedLink>
          </div>
        </div>
      </Section>
      <FitCheck label={label} source={captureSource({ kind: 'title', slug: `entry-${slug}` })} skills={role.skills} items={items} aiSkills={[]} />

      <Section id="market" title={`The market for ${lowerLabel} work`} note="Every figure names its source.">
        <FactGrid
          facts={[
            { key: 'open', label: `Open entry-level ${lowerLabel} jobs`, value: (facts?.jobs ?? 0).toLocaleString('en-US'), source: 'NextChapter, checked against employer career sites', period: 'last 7 days' },
            ...(facts && facts.jobs > 0 ? [{ key: 'noexp', label: 'Openings that say no experience is required', value: facts.noExperience.toLocaleString('en-US'), source: 'The posting’s own text, counted by NextChapter' }] : []),
            ...(facts && facts.training > 0 ? [{ key: 'training', label: 'Openings that say they provide training', value: facts.training.toLocaleString('en-US'), source: 'The posting’s own text, counted by NextChapter' }] : []),
            ...(facts?.median != null ? [{ key: 'pay', label: 'Median pay in listings that state it', value: usd(facts.median), source: `NextChapter verified openings (${facts.payCount.toLocaleString('en-US')} with pay)` }] : []),
            ...(ins?.outlook ? [{ key: 'outlook', label: 'Employment outlook, the closest government category', value: ins.outlook.line, source: 'BLS Employment Projections', period: `${ins.outlook.data.baseYear}–${ins.outlook.data.projectedYear}` }] : []),
            ...(ins?.exposure ? [{ key: 'ai', label: 'AI use at work, the closest government category', value: ins.exposure.sentence, source: 'Anthropic Economic Index' }] : []),
          ]}
        />
        {pay && <p className="mt-3 max-w-3xl text-sm text-muted-foreground">{pay}</p>}
        {ins?.occupation && <p className="mt-2 max-w-3xl text-xs text-muted-foreground">Outlook and AI-use figures are for the government category “{ins.occupation.title}”, the closest match to this job.</p>}
      </Section>

      {(live?.states.length ?? 0) > 0 && (
        <Section id="where" title={`Where entry-level ${lowerLabel} jobs are`}>
          <Chips kind="entry_role_to_state" event="topic_link_clicked" items={[
            ...cities.map(([, key, , jobs, name]) => ({ href: `/jobs/entry-level/${slug}/${key}`, label: name, detail: jobs.toLocaleString('en-US') })),
            ...live!.states.filter((s) => !cities.some((c) => c[1] === s.slug)).map((s) => ({ href: `/jobs/entry-level/${slug}/${s.slug}`, label: s.name, detail: s.jobs.toLocaleString('en-US') })),
          ]} />
          {live!.detail.topEmployers.length > 0 && (
            <>
              <h3 className="mt-5 text-sm font-semibold text-navy">Employers hiring {lowerLabel}s now</h3>
              <ul className="mt-2 flex flex-wrap gap-2 text-sm">
                {live!.detail.topEmployers.map((e) => <li key={e.name} className="rounded-full border border-border bg-white px-3 py-1.5 text-navy">{e.name} <span className="tabular-nums text-muted-foreground">{e.jobs}</span></li>)}
              </ul>
            </>
          )}
        </Section>
      )}

      <Section id="next" title={`More jobs like ${lowerLabel}`} note="Roles that use the same skills, and where this job commonly leads.">
        {moves.length > 0 && (
          <>
            <h3 className="text-sm font-semibold text-navy">Where it can lead</h3>
            <div className="mt-2"><Chips kind="entry_role_next" event="topic_link_clicked" items={moves.map((m) => ({ href: `/jobs/entry-level/${m.slug}`, label: roleLabel(m) }))} /></div>
          </>
        )}
        <h3 className="mt-5 text-sm font-semibold text-navy">Similar entry-level jobs</h3>
        <div className="mt-2"><Chips kind="entry_role_similar" event="topic_link_clicked" items={similar.map((m) => ({ href: `/jobs/entry-level/${m.slug}`, label: roleLabel(m) }))} /></div>
        <p className="mt-4 text-sm">
          <Link href={`/jobs/entry-level/category/${cat.slug}`} className={LINK}>All entry-level {cat.name.toLowerCase()} jobs</Link>
          {' · '}
          <Link href={`/jobs/title/${slugForTitle(label)}`} className={LINK}>{label} jobs at every level</Link>
        </p>
      </Section>

      <Section id="faq" title={`Questions about ${lowerLabel} jobs`}>
        <dl className="max-w-3xl space-y-4">
          {faqs.map((f) => (
            <div key={f.q}>
              <dt className="font-semibold text-navy">{f.q}</dt>
              <dd className="mt-1 text-sm text-muted-foreground">{f.a}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <JoinBand source={`entry-role:${slug}`} what={`how your background fits ${lowerLabel} roles and what to learn next`} />
    </TopicShell>
  )
}

const slugForTitle = (label: string) => label.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

