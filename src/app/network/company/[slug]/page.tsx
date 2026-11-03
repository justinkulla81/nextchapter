import type { Metadata } from 'next'
import Link from 'next/link'
import { permanentRedirect, redirect } from 'next/navigation'
import { PublicSiteHeader, PublicSiteFooter } from '@/components/marketing/PublicSiteChrome'
import { StructuredData } from '@/components/StructuredData'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { BoardList, NoticeTable } from '@/components/layoffs/NoticeTable'
import { JourneyPicker } from '@/components/home/JourneyPicker'
import { EmployerEmailCapture } from '@/components/network/EmployerEmailCapture'
import { OrgBrandScope } from '@/components/branding/OrgBrandScope'
import { getEmployerBrand } from '@/lib/branding/store'
import { NetworkViewTracker } from '@/components/network/NetworkViewTracker'
import { canonical } from '@/lib/seo/canonical'
import { DEFAULT_IMAGE, breadcrumbJsonLd, organizationRef, personRef } from '@/lib/seo/jsonld'
import { SITE_URL } from '@/lib/seo/facts'
import { stateName, stateSlug } from '@/lib/seo/states'
import { getCompanies, noticeDay, resolveCompanySlug } from '@/lib/warn/layoff-pages'
import { getNetworkCompany } from '@/lib/network/company'
import { networkCompanySeo } from '@/lib/seo/templates'
import { aboutCount, networkTitle, totalWorkers } from '@/lib/network/eligibility'
import { approvedStatementMap } from '@/lib/employer-statements/store'
import { titleMeta } from '@/lib/seo/title'

// One page per employer with a recent, sizeable WARN filing: what was filed, where the jobs are, which
// benefits and retraining apply, and a two-tap way in. Built on first visit, refreshed daily. An employer
// that no longer qualifies (notice over two years old, or under the minimum workers) redirects to its
// layoff page, so nothing thin is left in the index.
export const revalidate = 86400
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

// The situations a current or former employee is likely in, in the order the picker shows them.
const SITUATIONS = ['laid-off', 'thinking-about-a-move', 'managing-my-career', 'career-change', 'searching-too-long', 'new-grad']

const LINK = 'text-brand underline underline-offset-4'
const H2 = 'text-2xl font-bold tracking-tight text-navy'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const c = (await getCompanies()).get(slug)
  if (!c) return {}
  const states = c.states.map(stateName).join(', ')
  return {
    title: titleMeta(networkTitle(c.name)),
    description: `${c.name} filed ${c.notices.length} WARN layoff ${c.notices.length === 1 ? 'notice' : 'notices'} in ${states}, most recently ${noticeDay(c.latest)}. Open jobs, unemployment benefits, retraining and what to do first.`,
    ...canonical(`/network/company/${slug}`),
  }
}

export default async function NetworkCompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const companies = await getCompanies()
  const known = companies.get(slug)
  if (!known) {
    // No WARN filings under this slug: another spelling of an employer that has them, else the layoffs hub. Never a dead end.
    const alias = resolveCompanySlug(slug, companies.keys())
    if (alias) permanentRedirect(`/network/company/${alias}`)
    redirect('/layoffs')
  }
  const data = await getNetworkCompany(slug)
  if (!data) permanentRedirect(`/layoffs/company/${slug}`)

  const { company: c, state, atEmployer, inState } = data
  const [statements, brand] = await Promise.all([approvedStatementMap(slug, c.name), getEmployerBrand(c.name).catch(() => null)])
  const workers = totalWorkers(c)
  const stateLabel = stateName(state)
  const path = `/network/company/${slug}`
  const noticeWord = c.notices.length === 1 ? 'notice' : 'notices'
  const states = c.states.map(stateName)
  const jobsHref = `/jobs?loc=${encodeURIComponent(`, ${state}`)}`
  const shownJobs = (atEmployer.jobs.length > 0 ? atEmployer.jobs : inState.jobs).slice(0, 6)
  const shownLabel = atEmployer.jobs.length > 0 ? `Open professional jobs at ${c.name}` : `Newest professional jobs in ${stateLabel}`

  const faq = [
    {
      q: `Did ${c.name} file layoff notices?`,
      a: `Yes. ${c.name} has filed ${c.notices.length} WARN ${noticeWord} with ${states.length === 1 ? `the ${states[0]} labor department` : `labor departments in ${states.join(', ')}`}, naming ${workers.toLocaleString('en-US')} workers. The most recent was filed ${noticeDay(c.latest)}.`,
    },
    {
      q: `How do I file for unemployment after a layoff at ${c.name}?`,
      a: `File with the state where you worked, not where you live now. For ${stateLabel}, see the unemployment benefits page for the weekly amount, the number of weeks, the waiting week and where to file.`,
    },
    {
      q: `Are there jobs open for former ${c.name} employees?`,
      a: `${aboutCount(inState.total)} professional jobs are open in ${stateLabel} today${atEmployer.total > 0 ? `, and ${aboutCount(atEmployer.total)} at ${c.name} itself` : ''}. NextChapter lists them from employers' own career sites and checks that they are still open.`,
    },
    {
      q: 'What help is there for retraining?',
      a: 'The local American Job Center for each affected site offers free job search help and often pays for training. NextChapter also lists funding programs and graded AI courses.',
    },
  ]

  const pageLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${SITE_URL}${path}`,
    url: `${SITE_URL}${path}`,
    name: networkTitle(c.name),
    description: `WARN layoff notices filed by ${c.name}, open jobs, unemployment benefits and retraining.`,
    dateModified: c.latest.toISOString(),
    inLanguage: 'en-US',
    about: { '@type': 'Organization', name: c.name },
    author: personRef(),
    publisher: organizationRef(),
    image: DEFAULT_IMAGE,
    isBasedOn: c.notices.filter((n) => n.sourceUrl).slice(0, 5).map((n) => n.sourceUrl),
  }
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }

  return (
    <OrgBrandScope brand={brand?.pair}>
    <div className="flex flex-1 flex-col">
      <StructuredData data={breadcrumbJsonLd([{ name: 'Layoff tracker', path: '/layoffs' }, { name: c.name, path }])} />
      <StructuredData data={pageLd} />
      <StructuredData data={faqLd} />
      <NetworkViewTracker type="company" slug={slug} state={state} jobsInState={inState.total} jobsAtEmployer={atEmployer.total} />
      <PublicSiteHeader current="news" />
      <main className="flex-1 bg-off-white py-12">
        <div className="mx-auto max-w-6xl px-6">
          <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
            <Link href="/layoffs" className="hover:text-foreground">Layoff tracker</Link>
            <span aria-hidden> › </span>
            <span className="text-foreground">{c.name}</span>
          </nav>
<div className="mt-4 rounded-2xl bg-[var(--org-1,#14213D)] p-6 text-[var(--org-1-ink,#ffffff)] sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-80">NextChapter · for people leaving {c.name}</p>
            <h1 className="mt-3 text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl">
              {networkCompanySeo(c.name).h1}
            </h1>
            <p className="mt-3 max-w-2xl text-base opacity-90">
              {aboutCount(inState.total)} professional jobs are open in {stateLabel}
              {atEmployer.total > 0 && <>, including {aboutCount(atEmployer.total)} at {c.name}</>}. Put in your email and we send a plan built for a layoff: benefits and deadlines first, then jobs matched to your background.
            </p>
            <EmployerEmailCapture slug={slug} employer={c.name} />
          </div>

          <section aria-labelledby="jobs" className="mt-10">
            <h2 id="jobs" className={H2}>Jobs open now</h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              {aboutCount(inState.total)} professional jobs are open in {stateLabel}
              {atEmployer.total > 0 && <>, and {aboutCount(atEmployer.total)} at {c.name}</>}. Taken from employers&apos; own career sites and checked to still be open.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-[var(--org-1-soft,#eef2f7)] p-4">
              <p className="min-w-0 flex-1 text-sm text-navy">These are the newest roles, not yet matched to you. Add your email at the top and tell us about your work, and we pick the jobs that fit you.</p>
              <a href="#network-email" className="inline-flex h-11 items-center rounded-full bg-[var(--org-1,#14213D)] px-5 text-sm font-semibold text-[var(--org-1-ink,#ffffff)] hover:brightness-95">Personalize my jobs</a>
            </div>
            {shownJobs.length > 0 && (
              <div className="mt-4 rounded-xl border border-border bg-white">
                <h3 className="border-b border-border px-4 py-3 text-sm font-semibold text-navy">{shownLabel}</h3>
                <ul className="divide-y divide-border">
                  {shownJobs.map((j) => (
                    <li key={j.id} className="px-4 py-3 text-sm">
                      <TrackedLink
                        href={j.pagePath ?? j.url}
                        event="network_job_clicked"
                        properties={{ type: 'company', slug, jobId: j.id }}
                        className="font-medium text-navy hover:text-brand hover:underline"
                      >
                        {j.title}
                      </TrackedLink>
                      <span className="text-muted-foreground"> · {j.company}{j.location ? ` · ${j.location}` : ''}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="mt-4">
              <TrackedLink
                href={jobsHref}
                event="network_cta_clicked"
                properties={{ type: 'company', slug, button: 'see_all_jobs' }}
                className="inline-flex h-11 items-center rounded-full bg-action px-6 text-sm font-semibold text-action-foreground hover:brightness-95"
              >
                See all {aboutCount(inState.total)} jobs in {stateLabel}
              </TrackedLink>
            </p>
          </section>

          <section aria-labelledby="first" className="mt-12">
            <h2 id="first" className={H2}>What should I do first if I was affected?</h2>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm">
              {c.states.map((s) => (
                <li key={s}>
                  <Link href={`/unemployment-benefits/${stateSlug(s)}`} className={LINK}>File for {stateName(s)} unemployment benefits</Link>: amounts, weeks, the waiting week and where to file.
                </li>
              ))}
              <li><Link href="/resources/cobra-aca" className={LINK}>Compare COBRA and marketplace health coverage</Link> before your coverage ends.</li>
              <li><Link href="/resources/72-hours" className={LINK}>Use the first 72 hours</Link> on the steps that matter most.</li>
              <li><Link href="/resources/bridge-income" className={LINK}>Line up bridge income</Link> while you search.</li>
            </ol>
          </section>

          <section aria-labelledby="help" className="mt-12">
            <h2 id="help" className={H2}>What help is there for benefits and retraining?</h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              The public workforce boards for each affected site. Their American Job Centers offer free help with job search, training and filing for benefits.
            </p>
            <div className="mt-4"><BoardList notices={c.notices} page="company" /></div>
            <ul className="mt-5 list-disc space-y-1.5 pl-5 text-sm">
              <li><Link href="/funding" className={LINK}>Funding and benefit programs you may qualify for</Link></li>
              <li><Link href="/ai-skills" className={LINK}>Which AI skills employers ask for, and what they pay</Link></li>
              <li><Link href="/coaching" className={LINK}>Work with a career coach</Link></li>
            </ul>
          </section>

          <section aria-labelledby="join" className="mt-12 rounded-xl border border-border bg-white p-6">
            <h2 id="join" className="text-xl font-semibold tracking-tight text-navy">Not laid off? Pick what sounds like you</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">For anyone planning their next move at {c.name} or anywhere else. No résumé needed; we send a first-week plan.</p>
            <div className="mt-5">
              <JourneyPicker source={`network:company:${slug}`} compact situations={SITUATIONS} />
            </div>
          </section>

          <section aria-labelledby="faq" className="mt-12">
            <h2 id="faq" className={H2}>Questions</h2>
            <dl className="mt-4 space-y-5">
              {faq.map((f) => (
                <div key={f.q}>
                  <dt className="font-semibold text-navy">{f.q}</dt>
                  <dd className="mt-1 max-w-3xl text-sm text-muted-foreground">{f.a}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="what-filed" className="mt-12">
            <h2 id="what-filed" className={H2}>What did {c.name} file?</h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              A WARN notice gives the number of workers and the dates the employer reported. It does not say why. Notices are published by each state.
            </p>
            <div className="mt-4">
              <NoticeTable notices={c.notices} caption={`WARN notices filed by ${c.name}, newest first`} showState={c.states.length > 1} page="company" statements={statements} />
            </div>
            <p className="mt-3 text-sm">
              <Link href={`/layoffs/company/${slug}`} className={LINK}>Full notice record and news mentions for {c.name}</Link>
            </p>
          </section>

          <p className="mt-10 max-w-3xl text-sm text-muted-foreground">
            Notices are as filed with state labor departments and refreshed daily; the newest is dated {noticeDay(c.latest)}. Job counts are rounded.
            NextChapter is independent of {c.name}. See the <Link href="/layoffs" className={LINK}>layoff tracker</Link> for how notices are collected.
          </p>
        </div>
      </main>
      <PublicSiteFooter page="layoffs" />
    </div>
    </OrgBrandScope>
  )
}
