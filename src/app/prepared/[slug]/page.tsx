import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PROSPECTS, type Prospect } from '@/lib/prospects/config'
import { getArea, getCollege, getMarket, getNotices, functionLabel } from '@/lib/prospects/market'
import { Bars, DashboardPreview, LayoffList, LongSearchCard, Openings, PrivacyNote, Section, StatStrip, Steps } from '@/components/prospects/Sections'
import { ClaimForm } from '@/components/prospects/ClaimForm'
import { captureServerEvent } from '@/lib/posthog/server'

// Unlisted: built from public data for one organization, not for search engines (yet).
export const metadata: Metadata = { robots: { index: false, follow: false }, title: { absolute: 'Prepared for you | NextChapter' } }
export const revalidate = 21600

const n0 = (n: number) => n.toLocaleString('en-US')
const STATE_NAME: Record<string, string> = { KY: 'Kentucky', PA: 'Pennsylvania' }
const asOfLabel = (s: string) => { const m = /^(\d{4})-(\d{2})$/.exec(s); return m ? `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(m[2]) - 1]} ${m[1]}` : s }
const STEPS: Record<Prospect['kind'], { title: string; body: string }[]> = {
  talent: [
    { title: 'Share one link', body: 'Give it to any employer in a layoff, or to anyone who loses a job. They join in a minute and choose what to share.' },
    { title: 'Local jobs rank first', body: 'Each person gets a pivot plan from their own work history, retraining for the gaps, networking outreach drafted for them, coaching, and exclusive jobs and recruiters, with Louisville roles first.' },
    { title: 'See who stayed', body: 'You see counts of who engaged, interviewed and landed, and how many landed in Louisville. Never names.' },
  ],
  college: [
    { title: 'Reach affected alumni first', body: 'When layoffs hit, W&J writes to its own alumni with a link, and they opt in. Nobody is contacted without consent.' },
    { title: 'Retraining through W&J', body: 'Each alum gets a pivot plan, and retraining matched to their skill gaps, including W&J programs, plus networking outreach drafted and coaching.' },
    { title: 'Counts you can report', body: 'You see how many engaged, enrolled in a program, interviewed and landed in the region. Never names.' },
  ],
  employer: [
    { title: 'One link for anyone leaving', body: 'For a reduction or a single exit, one link goes in the announcement or the packet, with an account for everyone, at no charge to them.' },
    { title: 'A long search, supported', body: 'A pivot plan from their work history, retraining, networking outreach drafted, coaching, and exclusive jobs and recruiters, for two years, not 90 days.' },
    { title: 'Stay connected', body: 'You see counts of who engaged, interviewed and landed, never names. People who choose to can join an alumni network, which is also how the best come back.' },
  ],
}

export default async function ProspectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const p = PROSPECTS[slug]
  if (!p) notFound()
  const [market, notices, area, college] = await Promise.all([
    getMarket(p), getNotices(p), getArea(p.areaId), p.kind === 'college' ? getCollege('Washington & Jefferson') : Promise.resolve(null),
  ])
  captureServerEvent(`prospect:${slug}`, 'prospect_page_viewed', { slug })

  const place = p.placeLabel
  const stats = [
    { value: n0(market.openRoles), label: `white-collar roles open in ${place}`, note: `${n0(market.employersHiring)} employers hiring${market.medianPay ? `, median posted pay $${n0(market.medianPay)}` : ''}` },
    p.kind === 'employer'
      ? { value: '~650', label: "roles in Brown-Forman's January 2025 reduction", note: 'about 12% of its global workforce, per its release' }
      : { value: n0(notices.jobs), label: `jobs in layoff notices, last 6 months`, note: `${n0(notices.notices)} filings at ${notices.employers} employers${notices.scope === 'region' ? ' nearby' : ` in ${STATE_NAME[p.state] ?? p.state}`}` },
    p.kind === 'college' && college
      ? { value: n0(college.alumniEstimate ?? 0), label: 'W&J alumni (estimate)', note: `${n0(college.enrollment ?? 0)} students today` }
      : { value: area?.unemploymentRate != null ? `${area.unemploymentRate.toFixed(1)}%` : n0(market.aiRoles), label: area?.unemploymentRate != null ? `unemployment in ${area.name}` : 'AI-titled roles open', note: area?.unemploymentAsOf ? `${asOfLabel(area.unemploymentAsOf)}, BLS` : undefined },
  ]
  const fnItems = market.topFunctions.map((f) => ({ label: functionLabel(f.fn), value: f.roles }))

  return (
    <main className="mx-auto w-full min-w-0 max-w-4xl px-4 pb-16 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-4 text-sm">
        <p className="font-semibold text-navy">NextChapter <span className="font-normal text-muted-foreground">· prepared for {p.name}</span></p>
        <a href="#activate" className="rounded-full bg-orange px-4 py-1.5 font-medium text-navy hover:bg-orange/90">Activate this page</a>
      </header>

      <section className="space-y-6 py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">For {p.name}</p>
        <h1 className="font-serif text-4xl font-semibold leading-tight tracking-tight text-navy sm:text-5xl [text-wrap:balance]">{p.headline}</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">{p.lede}</p>
        <StatStrip stats={stats} />
      </section>

      <Section id="roles" eyebrow={`Live in ${place} today`} title={p.kind === 'employer' ? 'Where the next role could be, in the market your people are in' : p.kind === 'college' ? 'Open roles for W&J graduates in the region' : 'Open roles a laid-off Louisville professional can apply to this week'}>
        <p className="max-w-2xl text-muted-foreground">Real postings from our job database, seen in the last 14 days, one per field. Each links to the employer&apos;s own posting.</p>
        <Openings rows={market.sample} place={place} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Bars title="Who is hiring" items={market.topEmployers.map((e) => ({ label: e.name, value: e.roles }))} />
          <Bars title="What they are hiring for" items={fnItems} />
        </div>
      </Section>

      <Section eyebrow="What they are facing" title={p.kind === 'employer' ? 'A longer search than the market headline suggests' : 'Hiring is open, and searches are long'}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <LongSearchCard />
          {p.kind === 'employer' ? (
            <div className="rounded-2xl border border-border bg-white p-5">
              <h3 className="text-sm font-semibold text-navy">What Brown-Forman announced in January 2025</h3>
              <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-muted-foreground">
                <li>A reduction of about 12% of its global workforce: about 650 of 5,400 employees</li>
                <li>The closure of its Louisville cooperage, about 210 roles</li>
                <li>Severance, outplacement and benefits for those affected</li>
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">From <a className="underline underline-offset-4" href="https://www.businesswire.com/news/home/20250114888794/en" target="_blank" rel="noopener noreferrer">Brown-Forman&apos;s release</a>. Outplacement typically runs about 90 days; many of these searches ran longer.</p>
            </div>
          ) : (
            <LayoffList summary={notices} scope={notices.scope === 'region' ? 'the region' : (STATE_NAME[p.state] ?? p.state)} />
          )}
        </div>
        {p.kind === 'talent' && <p className="max-w-2xl text-sm text-muted-foreground">The Greater Louisville workforce area grew 2.1% from 2020 to 2024 (Census estimates), against 7.0% for Northern Middle Tennessee. Every professional who leaves for a faster-growing metro after a layoff is a loss Live in Lou then has to win back. Its goal is to add 41,000 working-age people to the region by 2030 (<a className="underline underline-offset-4" href="https://greaterlouisvillepartnership.com/talent-attraction-retention-development" target="_blank" rel="noopener noreferrer">Greater Louisville Inc.</a>).</p>}
        {p.kind === 'college' && college && <p className="max-w-2xl text-sm text-muted-foreground">W&amp;J enrolls about {n0(college.enrollment ?? 0)} students in {college.city}, and we estimate about {n0(college.alumniEstimate ?? 0)} living alumni (our estimate from enrollment and completions, not a count you gave us). Alumni in the region are the ones layoffs reach first.</p>}
      </Section>

      <Section eyebrow={`How it works for ${p.name}`} title={p.kind === 'talent' ? 'A simple way to keep talent in Louisville' : p.kind === 'college' ? 'A simple way to stay close to affected alumni' : 'A simple way to support everyone who leaves'}>
        <Steps steps={STEPS[p.kind]} />
        <DashboardPreview org={p.name} stay={p.stayLabel} />
      </Section>

      <Section id="activate" eyebrow="Get started" title={`Activate this page for ${p.name}`}>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          <div className="space-y-3 text-muted-foreground">
            <p>{p.claimLine}</p>
            <ul className="list-inside list-disc space-y-1 text-sm">
              <li>Takes about a minute. Nothing is created until you confirm.</li>
              <li>Free for the people you refer. Pricing for your workspace on request.</li>
              <li>We report counts only, never names.</li>
            </ul>
          </div>
          <ClaimForm slug={p.slug} orgName={p.name} />
        </div>
      </Section>

      <PrivacyNote asOf={new Date()} />
    </main>
  )
}
