import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect, redirect } from 'next/navigation'
import { Chips, FactGrid, JobList, LINK, RankList, Section, TopicShell } from '@/components/topics/blocks'
import { FitCheck } from '@/components/capture/FitCheck'
import { AiPremiumSection } from '@/components/salaries/AiPremiumSection'
import { captureSource } from '@/lib/capture/page-capture'
import { canonical } from '@/lib/seo/canonical'
import { SITE_URL } from '@/lib/seo/facts'
import { usd } from '@/lib/seo/job-title-rules'
import { getRoleDetail, getRoleIndex } from '@/lib/seo/role-figures'
import { ROLE_MIN_PAY, ladderOf, levelLabel, roleForAddress } from '@/lib/seo/role-pages'
import { roleSeo } from '@/lib/seo/templates'
import { titleMeta } from '@/lib/seo/title'
import { functionPath, industryPath, functionByName } from '@/lib/seo/topics'
import { functionImage } from '@/lib/seo/topic-images'
import { getJobStats } from '@/lib/seo/topic-data'
import { hasSalaryPage } from '@/lib/seo/job-titles'
import { AI_SKILL_ITEMS } from '@/lib/skills/ai-skills'

export const revalidate = 86400
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

const pct = (x: number) => `${Math.round(x * 100)}%`

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const d = await getRoleDetail(slug)
  if (!d) return { title: 'Role not found', robots: { index: false, follow: true } }
  const seo = roleSeo(d.role, d.stat.jobs, d.stat.median)
  return { title: titleMeta(seo.title), description: seo.description, ...canonical(`/roles/${slug}`) }
}

export default async function RolePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const known = roleForAddress(slug)
  if (!known) {
    if (!/^[a-z0-9-]{3,80}$/.test(slug)) notFound()
    redirect(`/jobs?q=${encodeURIComponent(slug.replace(/-/g, ' '))}`)
  }
  // An acronym or another word order ("/roles/cro", "/roles/head-of-sales") goes to the one address that holds the page.
  if (known.slug !== slug) permanentRedirect(`/roles/${known.slug}`)
  const d = await getRoleDetail(slug)
  // A role with too few open jobs has no page; send the visitor to a search for it instead of a 404.
  if (!d) redirect(`/jobs?q=${encodeURIComponent(known.spelled)}`)
  const { role, stat, figure } = d
  const path = `/roles/${slug}`
  const seo = roleSeo(role, stat.jobs, stat.median)
  const lower = role.short
  const paid = stat.median != null && stat.p25 != null && stat.p75 != null && stat.payCount >= ROLE_MIN_PAY
  const [fnStats, index] = await Promise.all([getJobStats({ fn: role.fn }).catch(() => null), getRoleIndex()])
  const fnTopic = functionByName(role.fn)
  const ladder = ladderOf(role).flatMap((r) => {
    const s = index.find((x) => x.slug === r.slug)
    return s ? [{ r, s }] : []
  })
  const workKnown = figure.work.remote + figure.work.hybrid + figure.work.onsite
  const remoteShare = workKnown >= 20 ? figure.work.remote / workKnown : null
  const topState = d.states[0]
  const topIndustry = d.industries[0]
  const topSkills = d.skills.slice(0, 5).map((s) => s.name)
  const aiItems = AI_SKILL_ITEMS.filter((i) => i.group === 'leadership' || i.group === 'applied').slice(0, 8).map((i) => ({ label: i.label, words: [i.label, ...i.aliases] }))
  const hasAcronymMeaning = !!role.acronym && role.level === 'c-suite' && initials(role.spelled) === role.acronym
  const byPay = d.states.filter((s) => s.median != null).sort((a, b) => (b.median ?? 0) - (a.median ?? 0))

  const faq: { q: string; a: string }[] = [
    { q: `What does a ${lower} do?`, a: `${role.owns} ${role.sits}` },
    ...(hasAcronymMeaning ? [{ q: `What does ${role.acronym} stand for?`, a: `${role.acronym} stands for ${role.spelled}. The same job is also written ${role.variants.filter((v) => v !== role.acronym && v !== role.spelled).slice(0, 4).join(', ')}.` }] : [{ q: `What else is a ${lower} called?`, a: `The same job is also written ${role.variants.filter((v) => v !== role.short).slice(0, 8).join(', ')}.` }]),
    { q: `How many ${lower} jobs are open?`, a: `${stat.jobs.toLocaleString('en-US')} verified open ${role.spelled} jobs, each checked against the employer’s own career site within the last week.` },
    ...(paid ? [{ q: `How much does a ${lower} make?`, a: `Among ${stat.payCount.toLocaleString('en-US')} open ${role.spelled} listings that state pay, the median is ${usd(stat.median!)} a year, and half of listings fall between ${usd(stat.p25!)} and ${usd(stat.p75!)}. This is pay the employer advertises for the job, not total compensation such as bonus or equity.` }] : []),
    ...(topState ? [{ q: `Where are ${lower} jobs?`, a: `${d.states.slice(0, 4).map((s) => `${s.name} (${s.jobs.toLocaleString('en-US')})`).join(', ')} have the most open ${role.spelled} listings.${remoteShare != null ? ` About ${pct(remoteShare)} of listings that state a work arrangement are remote.` : ''}` }] : []),
    ...(byPay[0] ? [{ q: `Which state pays a ${lower} the most?`, a: `Of the states with enough listings that state pay, ${byPay[0].name} has the highest median at ${usd(byPay[0].median!)}.` }] : []),
    ...(topIndustry ? [{ q: `Which industries hire for ${lower} roles?`, a: `${d.industries.slice(0, 4).map((i) => `${i.name} (${pct(i.share)})`).join(', ')}, as a share of listings whose employer has a known industry.` }] : []),
    ...(topSkills.length >= 3 ? [{ q: `What skills do ${lower} jobs ask for?`, a: `The skills named most often in open ${role.spelled} listings are ${topSkills.join(', ')}.` }] : []),
    ...(d.ai ? [{ q: `Do ${lower} jobs ask for AI skills?`, a: `${d.ai.sharePct}% of ${d.ai.sample.toLocaleString('en-US')} open ${role.spelled} listings read in full name a specific AI skill.${d.ai.items[0] ? ` The most common is ${d.ai.items[0].label}.` : ''}` }] : []),
  ]

  return (
    <TopicShell
      trail={[{ name: 'Roles', path: '/roles' }, { name: role.short, path }]}
      title={seo.h1}
      hero={functionImage(role.fn)}
      network={{ key: `role:${role.slug}`, kind: 'role', name: role.short, spelled: role.spelled }}
      capture={{ kind: 'title', slug, label: role.short, save: { q: role.spelled, loc: '' } }}
      intro={`${stat.jobs.toLocaleString('en-US')} open ${role.spelled} jobs${role.acronym && role.level === 'c-suite' ? ` (${role.acronym})` : ''}, taken from employers’ own career sites and checked to still be open. Also listed as ${role.variants.filter((v) => v !== role.short && v !== role.spelled).slice(0, 5).join(', ')}.${paid ? ` Listings that state pay show a median of ${usd(stat.median!)} a year.` : ''}`}
      jsonLd={[
        {
          '@context': 'https://schema.org', '@type': 'CollectionPage', name: seo.h1, url: `${SITE_URL}${path}`,
          mainEntity: { '@type': 'ItemList', itemListElement: d.jobs.map((j, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/jobs/${j.id}`, name: `${j.title} at ${j.company}` })) },
        },
        {
          '@context': 'https://schema.org', '@type': 'Occupation', name: role.spelled, alternateName: role.variants, url: `${SITE_URL}${path}`, description: role.owns,
          occupationLocation: { '@type': 'Country', name: 'United States' },
          ...(paid ? { estimatedSalary: [{ '@type': 'MonetaryAmountDistribution', name: 'base', currency: 'USD', duration: 'P1Y', percentile25: stat.p25, median: stat.median, percentile75: stat.p75 }] } : {}),
        },
        { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
      ]}
    >
      <Section id="market" title={`The market for ${role.spelled} work`} note="Every figure is counted from verified open listings. Pay is what the employer advertises for the job.">
        <FactGrid
          facts={[
            { key: 'open', label: `Verified open ${role.spelled} jobs`, value: stat.jobs.toLocaleString('en-US'), source: 'NextChapter, checked against employer career sites', period: 'last 7 days' },
            ...(paid ? [{ key: 'pay', label: 'Median pay in listings that state it', value: usd(stat.median!), source: 'NextChapter verified openings' }] : []),
            ...(topState ? [{ key: 'state', label: 'State with the most openings', value: `${topState.name} (${topState.jobs.toLocaleString('en-US')})`, source: 'NextChapter verified openings' }] : []),
            ...(topIndustry ? [{ key: 'industry', label: 'Industry hiring the most', value: `${topIndustry.name} (${pct(topIndustry.share)})`, source: 'NextChapter verified openings' }] : []),
            ...(remoteShare != null ? [{ key: 'remote', label: 'Listings that are remote', value: pct(remoteShare), source: 'NextChapter verified openings' }] : []),
            ...(d.ai ? [{ key: 'ai', label: 'Listings that ask for an AI skill', value: `${d.ai.sharePct}%`, source: 'NextChapter verified openings, read in full' }] : []),
          ]}
        />
      </Section>

      <Section id="role" title={`What a ${lower} does`} note={`${levelLabel(role.level)} role in ${role.fn}.`}>
        <p className="max-w-3xl text-base text-navy">{role.owns}</p>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{role.sits}</p>
        <h3 className="mt-5 text-sm font-semibold text-navy">Other ways this role is written</h3>
        <ul className="mt-2 flex flex-wrap gap-2 text-sm">
          {role.variants.map((v) => <li key={v} className="rounded-full border border-border bg-white px-3 py-1.5 text-navy">{v}</li>)}
        </ul>
        <p className="mt-3 max-w-3xl text-xs text-muted-foreground">Listings under any of these titles are counted on this page. Assistant, associate, manager and staff titles are not.</p>
      </Section>

      <Section id="jobs" title={`Open ${role.spelled} jobs`} note="Verified against the employer’s own career site within the last week.">
        <JobList jobs={d.jobs} total={stat.jobs} source={`role:${slug}`} />
        <p className="mt-3 text-sm"><Link href={`/jobs?q=${encodeURIComponent(role.spelled)}`} className={LINK}>Search all {role.spelled} jobs</Link></p>
      </Section>

      {paid && (
        <Section id="pay" title={`${role.short} salary`} note={`From ${stat.payCount.toLocaleString('en-US')} open listings that state pay. Annual, in US dollars, base pay only.`}>
          <dl className="grid max-w-2xl grid-cols-3 gap-4 text-center">
            {[['Lower quarter', stat.p25!], ['Median', stat.median!], ['Upper quarter', stat.p75!]].map(([label, v]) => (
              <div key={label as string} className="rounded-xl border border-border bg-white p-5">
                <dt className="text-xs text-muted-foreground">{label as string}</dt>
                <dd className="mt-1 text-2xl font-bold tabular-nums text-navy">{usd(v as number)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 max-w-3xl text-xs text-muted-foreground">Leadership pay often includes bonus and equity that a listing does not state. Treat these figures as the floor of the conversation, not the whole package.</p>
        </Section>
      )}

      {d.industries.length > 0 && (
        <Section id="industries" title={`Best industries for ${lower} jobs`} note="Employers hiring the most, as a share of listings whose employer has a known industry. Median pay shown where at least 8 listings state it.">
          <Chips
            kind="role_to_industry"
            event="topic_link_clicked"
            items={d.industries.map((i) => ({ href: industryPath(i.name), label: i.name, detail: `${pct(i.share)}${i.median != null ? ` · ${usd(i.median)}` : ''}` }))}
          />
        </Section>
      )}

      {d.states.length > 0 && (
        <Section id="states" title={`Where ${lower} jobs are`} note="States with the most open listings; median pay where at least 8 listings state it.">
          <Chips
            kind="role_to_state"
            event="topic_link_clicked"
            items={d.states.map((s) => ({ href: `/places/${s.slug}`, label: s.name, detail: `${s.jobs.toLocaleString('en-US')}${s.median != null ? ` · ${usd(s.median)}` : ''}` }))}
          />
        </Section>
      )}

      {(d.skills.length > 0 || fnStats) && (
        <Section id="skills" title={`Skills ${lower} jobs ask for`} note={`${d.skills.length > 0 ? `Named in the listings themselves, as a share of ${figure.skillSample.toLocaleString('en-US')} ${role.spelled} listings that name skills. ` : ''}Leadership listings name fewer skills than individual-contributor ones, so this is a signal, not a checklist.`}>
          <div className="grid gap-3 sm:grid-cols-2">
            {d.skills.length > 0 && <RankList tone={2} title={`Most named in ${lower} listings`} items={d.skills.slice(0, 10).map((s) => ({ label: s.name, detail: pct(s.share) }))} />}
            {fnStats && fnStats.skills.length > 0 && (
              <RankList tone={3} title={`Across all ${role.fn} openings`} items={fnStats.skills.slice(0, 10).map((s) => ({ label: s.name, detail: pct(s.count / fnStats.sample) }))} />
            )}
          </div>
        </Section>
      )}

      {(d.ai || fnStats) && (
        <Section id="ai-demand" title={`AI skills for ${lower} jobs`} note="Specific AI skills named in the full posting text, such as prompt engineering, AI governance or an AI tool. A general mention of AI does not count.">
          {d.ai && (
            <p className="max-w-3xl text-base text-navy">
              {d.ai.sharePct}% of {d.ai.sample.toLocaleString('en-US')} open {role.spelled} listings ask for a specific AI skill{fnStats ? `, against ${fnStats.aiSkillPct}% of all ${role.fn} openings` : ''}.
            </p>
          )}
          {!d.ai && fnStats && <p className="max-w-3xl text-base text-navy">{fnStats.aiSkillPct}% of {role.fn} openings ask for a specific AI skill. There are too few {role.spelled} listings read in full to give a figure for this role alone.</p>}
          {d.ai && d.ai.items.length > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <RankList tone={3} title="AI skills named most often" items={d.ai.items.map((i) => ({ label: i.label, detail: pct(i.share) }))} />
            </div>
          )}
        </Section>
      )}
      <AiPremiumSection title={role.spelled} slug={slug} fn={role.fn} />

      {d.skills.length + (fnStats?.skills.length ?? 0) > 0 && (
        <FitCheck label={role.spelled} source={captureSource({ kind: 'title', slug })} skills={(d.skills.length > 0 ? d.skills.map((s) => s.name) : fnStats?.skills.map((s) => s.name) ?? []).slice(0, 10)} aiSkills={aiItems} />
      )}

      {ladder.length > 0 && (
        <Section id="ladder" title={`The ${role.fn} ladder`} note="The same function at other levels: where this role comes from and where it leads.">
          <Chips
            kind="role_to_role"
            event="topic_link_clicked"
            items={ladder.map(({ r, s }) => ({ href: `/roles/${r.slug}`, label: r.short, detail: `${s.jobs.toLocaleString('en-US')}${s.median != null && s.payCount >= ROLE_MIN_PAY ? ` · ${usd(s.median)}` : ''}` }))}
          />
          {fnTopic && <p className="mt-3 text-sm"><Link href={functionPath(fnTopic.name)} className={LINK}>All {role.fn} jobs</Link></p>}
        </Section>
      )}

      {d.titles.length > 0 && (
        <Section id="titles" title={`Job titles under ${lower}`} note="The exact titles employers use, with their own job and salary pages.">
          <Chips
            kind="role_to_title"
            event="topic_link_clicked"
            items={d.titles.map((t) => ({ href: hasSalaryPage(t) ? `/salaries/${t.slug}` : `/jobs/title/${t.slug}`, label: t.name, detail: `${t.jobs.toLocaleString('en-US')}${hasSalaryPage(t) ? ` · ${usd(t.median!)}` : ''}` }))}
          />
        </Section>
      )}

      {figure.employers.length > 0 && (
        <Section id="employers" title={`Employers hiring for ${lower} roles`}>
          <ul className="flex flex-wrap gap-2 text-sm">
            {figure.employers.map((e) => <li key={e.name} className="rounded-full border border-border bg-white px-3 py-1.5 text-navy">{e.name} <span className="tabular-nums text-muted-foreground">{e.jobs}</span></li>)}
          </ul>
        </Section>
      )}

      <Section id="faq" title={`${role.short} questions`}>
        <dl className="max-w-3xl space-y-4 text-sm">
          {faq.map((f) => <div key={f.q}><dt className="font-medium text-navy">{f.q}</dt><dd className="mt-1 text-muted-foreground">{f.a}</dd></div>)}
        </dl>
      </Section>

    </TopicShell>
  )
}

/** "Chief Revenue Officer" -> "CRO"; "Chief Information Security Officer" -> "CISO". */
function initials(spelled: string): string {
  return spelled.split(/\s+/).filter((w) => !['of', 'and'].includes(w.toLowerCase())).map((w) => w[0]).join('').toUpperCase()
}
