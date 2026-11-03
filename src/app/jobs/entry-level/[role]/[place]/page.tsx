import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Chips, JobList, JoinBand, LINK, RankList, Section, TopicShell } from '@/components/topics/blocks'
import { SaveSearchForm } from '@/components/home/SaveSearchForm'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { PERSONALIZE_HREF } from '@/components/home/PersonalizePanel'
import { canonical } from '@/lib/seo/canonical'
import { SITE_URL } from '@/lib/seo/facts'
import { parsePlace } from '@/lib/seo/job-title-places'
import { usd } from '@/lib/seo/job-title-rules'
import { titleMeta } from '@/lib/seo/title'
import { entryRole } from '@/lib/entry-roles/roles'
import { getEntryPlaceLive } from '@/lib/entry-roles/live'
import { rolePlaceSeo, roleLabel } from '@/lib/entry-roles/text'

// One entry-level role in one city or state: "entry-level <role> jobs in <place>". A pair below the bar (roles.ts ENTRY_PLACE_BARS) has
// no stored row, so its address redirects to the role page; it gets a page by itself once enough listings arrive.
export const revalidate = 86400
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: { params: Promise<{ role: string; place: string }> }): Promise<Metadata> {
  const { role: slug, place } = await params
  const role = entryRole(slug)
  const d = role ? await getEntryPlaceLive(slug, place) : null
  if (!role || !d) return { title: 'Entry-level jobs', robots: { index: false, follow: true } }
  const seo = rolePlaceSeo(role, d.place.name, d.place.jobs, d.place.median)
  return { title: titleMeta(seo.title), description: seo.description, ...canonical(`/jobs/entry-level/${slug}/${place}`) }
}

export default async function EntryRolePlacePage({ params }: { params: Promise<{ role: string; place: string }> }) {
  const { role: slug, place } = await params
  if (!/^[a-z0-9-]{3,80}$/.test(slug) || !parsePlace(place)) notFound()
  const role = entryRole(slug)
  if (!role) redirect('/jobs/entry-level')
  const d = await getEntryPlaceLive(slug, place)
  if (!d) redirect(`/jobs/entry-level/${slug}`)
  const { place: p, jobs } = d
  const path = `/jobs/entry-level/${slug}/${place}`
  const label = roleLabel(role)
  const lower = label.toLowerCase()
  const seo = rolePlaceSeo(role, p.name, p.jobs, p.median)
  return (
    <TopicShell
      trail={[{ name: 'Jobs', path: '/jobs' }, { name: 'Entry-level jobs', path: '/jobs/entry-level' }, { name: label, path: `/jobs/entry-level/${slug}` }, { name: p.name, path }]}
      title={seo.h1}
      intro={`${p.jobs.toLocaleString('en-US')} open entry-level ${lower} jobs in ${p.name}, taken from employers’ own career sites and checked to still be open.${p.median ? ` Listings that state pay show a median of ${usd(p.median)} a year.` : ''} ${role.what}`}
      jsonLd={[
        {
          '@context': 'https://schema.org', '@type': 'CollectionPage', name: seo.h1, url: `${SITE_URL}${path}`,
          about: { '@type': 'Occupation', name: label },
          mainEntity: { '@type': 'ItemList', itemListElement: jobs.map((j, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/jobs/${j.id}`, name: `${j.title} at ${j.company}` })) },
        },
      ]}
    >
      <Section id="jobs" title={`Open entry-level ${lower} jobs in ${p.name}`} note="Verified against the employer’s own career site within the last week.">
        <JobList jobs={jobs} total={p.jobs} source={`entry-role-place:${slug}:${place}`} />
        <p className="mt-3 text-sm">
          <Link href={`/jobs?q=${encodeURIComponent(label)}&loc=${encodeURIComponent(p.name)}`} className={LINK}>Search all {lower} jobs in {p.name}</Link>
          {' · '}
          <Link href={`/jobs/entry-level/${slug}`} className={LINK}>What a {lower} does and the skills it takes</Link>
        </p>
        <div className="mt-5"><SaveSearchForm q={label} loc={p.name} remote={false} source="page:title-place" heading={`Get new ${lower} jobs in ${p.name} by email`} blurb="We’ll email you when new matches are posted. No account needed." cta="Email me new jobs" /></div>
      </Section>

      <Section id="about" title={`The ${lower} job in ${p.name}`} note="The job is the same anywhere; what changes is who is hiring.">
        <div className="grid gap-4 sm:grid-cols-2">
          <RankList tone={1} title="A typical day" items={role.tasks.map((t) => ({ label: t }))} />
          <RankList tone={2} title="Skills it uses" items={role.skills.slice(0, 7).map((s) => ({ label: s }))} />
        </div>
        <TrackedLink
          href={`${PERSONALIZE_HREF}&role=${slug}&goal=skills&place=${place}`}
          event="entry_role_training_clicked"
          properties={{ roleSlug: slug, place, category: role.cat, openJobs: p.jobs }}
          className="mt-4 inline-flex text-sm font-semibold text-brand underline underline-offset-4"
        >
          Find training for these skills
        </TrackedLink>
      </Section>

      {p.employers.length > 0 && (
        <Section id="employers" title={`Employers hiring in ${p.name}`}>
          <ul className="flex flex-wrap gap-2 text-sm">
            {p.employers.map((e) => <li key={e.name} className="rounded-full border border-border bg-white px-3 py-1.5 text-navy">{e.name} <span className="tabular-nums text-muted-foreground">{e.jobs}</span></li>)}
          </ul>
        </Section>
      )}
      {(p.nearby.length > 0 || p.otherTitles.length > 0) && (
        <Section id="more" title="More entry-level jobs">
          {p.nearby.length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-navy">{label} jobs nearby</h3>
              <div className="mt-2"><Chips kind="entry_place_nearby" event="topic_link_clicked" items={p.nearby.map((x) => ({ href: `/jobs/entry-level/${slug}/${x.key}`, label: x.name, detail: x.jobs.toLocaleString('en-US') }))} /></div>
            </>
          )}
          {p.otherTitles.length > 0 && (
            <>
              <h3 className="mt-5 text-sm font-semibold text-navy">Other entry-level jobs in {p.name}</h3>
              <div className="mt-2"><Chips kind="entry_place_other_roles" event="topic_link_clicked" items={p.otherTitles.map((x) => ({ href: `/jobs/entry-level/${x.slug}/${place}`, label: x.name, detail: x.jobs.toLocaleString('en-US') }))} /></div>
            </>
          )}
        </Section>
      )}
      <JoinBand source={`entry-role-place:${slug}`} what={`how your background fits ${lower} roles in ${p.name}`} />
    </TopicShell>
  )
}
