import Link from 'next/link'
import { Chips, JoinBand, LINK, Section, TopicShell } from '@/components/topics/blocks'
import { SegmentJobs, SegmentTable } from '@/components/segments/SegmentTable'
import { SEGMENTS } from '@/lib/segments/defs'
import { AMERICA_NOTE, CUTS, changeClause, cutById, cutPath, cutSentence, methodNotes, segmentPath } from '@/lib/segments/cuts'
import { count, publishedCuts, usdK } from '@/lib/segments/aggregate'
import { employerHrefs, type SegmentPageData } from '@/lib/segments/page-data'
import { MIN_SEGMENT_JOBS, type SegmentDef } from '@/lib/segments/defs'
import { SITE_URL } from '@/lib/seo/facts'
import { editionLabel } from '@/lib/rankings/build-edition'
import type { CutId, SegmentIndexEntry } from '@/lib/segments/types'

const EMPLOYER_CUTS = new Set<CutId>(['top-employers', 'highest-paying-employers', 'entry-level'])

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <p className="text-2xl font-bold tabular-nums text-navy">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

function OtherSegments({ current, index }: { current: string; index: SegmentIndexEntry[] }) {
  const items = index.filter((x) => x.slug !== current).map((x) => ({ href: segmentPath(x.slug), label: x.name, detail: count(x.total) }))
  if (!items.length) return null
  return (
    <Section id="more" title="More industries" tone={1}>
      <Chips kind="segment_to_segment" event="segment_list_clicked" items={items} />
    </Section>
  )
}

/** One segment's page: the headline figures and the top of each list. `data.newest` false is an archived month. */
export async function SegmentHubView({ data, index }: { data: SegmentPageData; index: SegmentIndexEntry[] }) {
  const { def, entry, e, newest } = data
  const path = newest ? segmentPath(def.slug) : `${segmentPath(def.slug)}/${e.edition}`
  const cuts = publishedCuts(e)
  const month = editionLabel(e.edition)
  const hrefs = await employerHrefs(e.cuts['top-employers']?.slice(0, 10) ?? [])
  const change = changeClause(e)
  const intro = `${def.blurb} ${count(e.total)} open jobs at ${count(e.employers)} employers${e.payMed ? `, with a median stated pay of ${usdK(e.payMed)}` : ''}. ${AMERICA_NOTE}`
  const allHref = `/jobs?q=${encodeURIComponent(def.query)}`
  return (
    <TopicShell
      trail={[{ name: 'Jobs', path: '/jobs' }, { name: 'Jobs by industry', path: '/jobs/industry' }, { name: def.name, path }]}
      title={`${def.name} jobs: who is hiring and what it pays${newest ? '' : `, ${month}`}`}
      intro={intro}
      capture={{ kind: 'industry', slug: def.slug, label: def.name, save: { q: def.query, loc: '' } }}
      jsonLd={[{
        '@context': 'https://schema.org', '@type': 'CollectionPage', name: `${def.name} jobs`, url: `${SITE_URL}${path}`,
        mainEntity: { '@type': 'ItemList', itemListElement: (e.cuts['top-employers'] ?? []).slice(0, 10).map((r) => ({ '@type': 'ListItem', position: r.rank, name: `${r.name}: ${r.valueLabel}` })) },
      }]}
    >
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={`open ${def.label} jobs`} value={count(e.total)} />
        <Stat label="employers hiring" value={count(e.employers)} />
        <Stat label={e.payMed ? `median stated pay (${count(e.paid)} jobs)` : 'median stated pay'} value={e.payMed ? usdK(e.payMed) : 'Not enough pay data'} />
        <Stat label={e.prev ? `change since ${editionLabel(e.prev.edition)}` : 'first month tracked'} value={e.prev ? `${e.total - e.prev.total >= 0 ? '+' : '−'}${count(Math.abs(e.total - e.prev.total))}` : month} />
      </div>
      {change && <p className="mt-3 text-sm text-muted-foreground">{change}</p>}

      {newest && cuts.length > 0 && (
        <Section id="lists" title={`All ${def.label} lists`} tone={0}>
          <Chips kind="segment_to_cut" event="segment_list_clicked" items={CUTS.filter((c) => cuts.includes(c.id)).map((c) => ({ href: cutPath(def.slug, c.id), label: c.short }))} />
        </Section>
      )}

      {(e.cuts['top-employers']?.length ?? 0) > 0 && (
        <Section id="employers" title={`Employers with the most open ${def.label} jobs`} note={cutSentence(def, 'top-employers', e)}>
          <SegmentTable rows={e.cuts['top-employers']!} limit={10} valueHead="Open jobs" nounHead="Employer" hrefs={hrefs} segment={def.slug} cut="top-employers" />
          {newest && <p className="mt-3 text-sm"><Link href={cutPath(def.slug, 'top-employers')} className={LINK}>See the full top 25</Link></p>}
        </Section>
      )}

      {(e.cuts['highest-paying-roles']?.length ?? 0) > 0 && (
        <Section id="pay" title={`Highest-paying ${def.label} roles`} note={cutSentence(def, 'highest-paying-roles', e)}>
          <SegmentTable rows={e.cuts['highest-paying-roles']!} limit={8} valueHead="Median pay" nounHead="Role" segment={def.slug} cut="highest-paying-roles" />
          {newest && <p className="mt-3 text-sm"><Link href={cutPath(def.slug, 'highest-paying-roles')} className={LINK}>See all highest-paying roles</Link></p>}
        </Section>
      )}

      {(e.cuts['top-skills']?.length ?? 0) > 0 && (
        <Section id="skills" title={`Skills employers ask for`} note={cutSentence(def, 'top-skills', e)}>
          <Chips kind="segment_skill" event="segment_list_clicked" items={e.cuts['top-skills']!.slice(0, 12).map((s) => ({ href: `/jobs?q=${encodeURIComponent(`${s.name} ${def.query}`)}`, label: s.name, detail: s.valueLabel }))} />
        </Section>
      )}

      {(e.cuts['top-states']?.length ?? 0) > 0 && (
        <Section id="states" title={`Where the ${def.label} jobs are`} note={cutSentence(def, 'top-states', e)}>
          <SegmentTable rows={e.cuts['top-states']!} limit={8} valueHead="Open jobs" nounHead="State" segment={def.slug} cut="top-states" />
        </Section>
      )}

      {newest && e.newest.length > 0 && (
        <Section id="new" title={`New ${def.label} jobs this week`} note={cutSentence(def, 'newest', e)}>
          <SegmentJobs jobs={e.newest.slice(0, 8)} segment={def.slug} cut="newest" allHref={allHref} />
          <p className="mt-3 text-sm"><Link href={allHref} className={LINK}>Search all {def.label} jobs</Link></p>
        </Section>
      )}

      {entry.editions.length > 1 && (
        <Section id="months" title="Earlier months" tone={2}>
          <Chips kind="segment_month" event="segment_list_clicked" items={entry.editions.map((ed, i) => ({ href: i === 0 ? segmentPath(def.slug) : `${segmentPath(def.slug)}/${ed}`, label: editionLabel(ed) }))} />
        </Section>
      )}

      <OtherSegments current={def.slug} index={index} />

      <Section id="method" title="How these lists are made" tone={2}>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">{methodNotes(def).map((m) => <li key={m}>{m}</li>)}</ul>
        <p className="mt-3 text-xs text-muted-foreground">Built {new Date(e.builtAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}.</p>
      </Section>

      <JoinBand source={`segment:${def.slug}`} what={`how the market reads your background for ${def.label} roles`} />
    </TopicShell>
  )
}

/** One list on its own page. */
export async function SegmentCutView({ data, cut, index }: { data: SegmentPageData; cut: CutId; index: SegmentIndexEntry[] }) {
  const { def, e } = data
  const c = cutById(cut)!
  const path = cutPath(def.slug, cut)
  const rows = e.cuts[cut] ?? []
  const hrefs = EMPLOYER_CUTS.has(cut) ? await employerHrefs(rows) : undefined
  const title = c.title(def)
  const allHref = `/jobs?q=${encodeURIComponent(def.query)}`
  const isJobs = cut === 'newest' || (cut === 'entry-level' && e.entry.jobs.length > 0)
  return (
    <TopicShell
      trail={[{ name: 'Jobs', path: '/jobs' }, { name: 'Jobs by industry', path: '/jobs/industry' }, { name: def.name, path: segmentPath(def.slug) }, { name: c.short, path }]}
      title={title}
      intro={`${cutSentence(def, cut, e)} ${AMERICA_NOTE}`}
      capture={{ kind: 'industry', slug: `${def.slug}-${cut}`, label: def.name, save: { q: def.query, loc: '' } }}
      jsonLd={[{
        '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url: `${SITE_URL}${path}`,
        mainEntity: { '@type': 'ItemList', itemListElement: (cut === 'newest' ? e.newest.map((j, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/jobs/${j.id}`, name: `${j.title} at ${j.company}` })) : rows.map((r) => ({ '@type': 'ListItem', position: r.rank, name: `${r.name}: ${r.valueLabel}` }))) },
      }]}
    >
      {cut === 'newest' ? (
        <Section id="list" title={title}><SegmentJobs jobs={e.newest} segment={def.slug} cut={cut} allHref={allHref} /></Section>
      ) : (
        <>
          {rows.length > 0 && (
            <Section id="list" title={title} note={`Rebuilt weekly. ${editionLabel(e.edition)} edition.`}>
              <SegmentTable rows={rows} valueHead={c.valueHead} nounHead={c.nounHead} hrefs={hrefs} segment={def.slug} cut={cut} />
            </Section>
          )}
          {isJobs && cut === 'entry-level' && (
            <Section id="jobs" title="Newest entry-level jobs" tone={1}><SegmentJobs jobs={e.entry.jobs} segment={def.slug} cut={cut} allHref={`${allHref}&level=entry`} /></Section>
          )}
        </>
      )}
      <p className="mt-6 text-sm"><Link href={allHref} className={LINK}>Search all {def.label} jobs</Link> · <Link href={segmentPath(def.slug)} className={LINK}>Back to {def.name.toLowerCase()} jobs</Link></p>
      <Section id="lists" title={`More ${def.label} lists`} tone={0}>
        <Chips kind="segment_to_cut" event="segment_list_clicked" items={CUTS.filter((x) => x.id !== cut && publishedCuts(e).includes(x.id)).map((x) => ({ href: cutPath(def.slug, x.id), label: x.short }))} />
      </Section>
      <OtherSegments current={def.slug} index={index} />
      <JoinBand source={`segment:${def.slug}:${cut}`} what={`how the market reads your background for ${def.label} roles`} />
    </TopicShell>
  )
}

/** A segment with too few jobs to publish honest lists: says so, keeps the email save and the employer inquiry, and points to what is live. */
export function SegmentSoonView({ def, found, index }: { def: SegmentDef; found: number; index: SegmentIndexEntry[] }) {
  const path = segmentPath(def.slug)
  const allHref = `/jobs?q=${encodeURIComponent(def.query)}`
  return (
    <TopicShell
      trail={[{ name: 'Jobs', path: '/jobs' }, { name: 'Jobs by industry', path: '/jobs/industry' }, { name: def.name, path }]}
      title={`${def.name} jobs: lists coming soon`}
      intro={`${def.blurb} We publish a list only when there are enough verified openings to rank honestly, at least ${MIN_SEGMENT_JOBS}. ${found > 0 ? `We have ${count(found)} so far.` : 'We have not found enough yet.'} We check every week, so check back next month, or leave your email and we will tell you when ${def.label} jobs are posted.`}
      capture={{ kind: 'industry', slug: def.slug, label: def.name, save: { q: def.query, loc: '' } }}
    >
      <Section id="now" title={`Looking for ${def.label} jobs now?`} tone={0}>
        <p className="text-sm text-muted-foreground">{AMERICA_NOTE}</p>
        <p className="mt-3 text-sm"><Link href={allHref} className={LINK}>Search all {def.label} jobs</Link></p>
      </Section>
      <OtherSegments current={def.slug} index={index.filter((x) => !x.soon)} />
      <JoinBand source={`segment:${def.slug}:soon`} what={`how the market reads your background for ${def.label} roles`} />
    </TopicShell>
  )
}

export { SEGMENTS }
