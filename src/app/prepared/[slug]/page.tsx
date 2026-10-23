import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PROSPECTS } from '@/lib/prospects/config'
import { getArea, getCollege, getHub, getMarket, getNotices, getReadiness } from '@/lib/prospects/market'
import { LongSearchCard, PrivacyNote, Section, StatStrip } from '@/components/prospects/Sections'
import { HubTabs } from '@/components/prospects/HubTabs'
import { ContactsPanel, EmployersPanel, EngagePanel, HomePanel, JobsPanel, LearnPanel, SkillsPanel } from '@/components/prospects/HubPanels'
import { ClaimForm } from '@/components/prospects/ClaimForm'
import { captureServerEvent } from '@/lib/posthog/server'

// Unlisted: built from public data for one organization, not for search engines (yet).
export const metadata: Metadata = { robots: { index: false, follow: false }, title: { absolute: 'Prepared for you | NextChapter' } }
export const revalidate = 21600

const n0 = (n: number) => n.toLocaleString('en-US')
const STATE_NAME: Record<string, string> = { KY: 'Kentucky', PA: 'Pennsylvania' }
const asOfLabel = (s: string) => { const m = /^(\d{4})-(\d{2})$/.exec(s); return m ? `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(m[2]) - 1]} ${m[1]}` : s }

export default async function ProspectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const p = PROSPECTS[slug]
  if (!p) notFound()
  const [market, notices, area, college, hub, readiness] = await Promise.all([
    getMarket(p), getNotices(p), getArea(p.areaId), p.kind === 'college' ? getCollege('Washington & Jefferson') : Promise.resolve(null), getHub(p), getReadiness(p),
  ])
  captureServerEvent(`prospect:${slug}`, 'prospect_page_viewed', { slug })

  const place = p.placeLabel
  const scope = notices.scope === 'region' ? 'the region' : (STATE_NAME[p.state] ?? p.state)
  const stats = [
    { value: n0(market.openRoles), label: `white-collar roles open in ${place}`, note: `${n0(market.employersHiring)} employers hiring${market.medianPay ? `, median posted pay $${n0(market.medianPay)}` : ''}` },
    p.kind === 'employer'
      ? { value: '~650', label: "roles in Brown-Forman's January 2025 reduction", note: 'about 12% of its global workforce, per its release' }
      : { value: n0(notices.jobs), label: 'jobs in layoff notices, last 6 months', note: `${n0(notices.notices)} filings at ${notices.employers} employers${notices.scope === 'region' ? ' nearby' : ` in ${STATE_NAME[p.state] ?? p.state}`}` },
    p.kind === 'college' && college
      ? { value: n0(college.alumniEstimate ?? 0), label: 'W&J alumni (estimate)', note: `${n0(college.enrollment ?? 0)} students today` }
      : { value: area?.unemploymentRate != null ? `${area.unemploymentRate.toFixed(1)}%` : n0(market.aiRoles), label: area?.unemploymentRate != null ? `unemployment in ${area.name}` : 'AI-titled roles open', note: area?.unemploymentAsOf ? `${asOfLabel(area.unemploymentAsOf)}, BLS` : undefined },
  ]

  const tabs = [
    { id: 'home', label: 'Home', panel: <HomePanel p={p} /> },
    { id: 'jobs', label: 'Jobs', panel: <JobsPanel market={market} place={place} /> },
    { id: 'skills', label: 'Skills and AI readiness', panel: <SkillsPanel fields={readiness} place={place} orgName={p.name} /> },
    { id: 'employers', label: 'Local employers', panel: <EmployersPanel market={market} notices={notices} scope={scope} /> },
    { id: 'learn', label: 'Learn and retrain', panel: <LearnPanel hub={hub} p={p} /> },
    { id: 'contacts', label: 'People and help', panel: <ContactsPanel hub={hub} p={p} /> },
    { id: 'engage', label: 'Get people in', panel: <EngagePanel p={p} /> },
  ]

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

      <Section id="preview" eyebrow="Your page, switched on" title={`This is what ${p.welcome.who} would see`}>
        <p className="max-w-2xl text-muted-foreground">We built the first version for you from public data, so you can click through it. Every tab is real, from your local jobs and skills to the workforce help nearby. Activate it and it goes live under your name.</p>
        <div className="overflow-hidden rounded-2xl border border-border bg-off-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-border bg-white px-4 py-2" aria-hidden>
            <span className="size-2.5 rounded-full bg-border" /><span className="size-2.5 rounded-full bg-border" /><span className="size-2.5 rounded-full bg-border" />
            <span className="ml-3 truncate rounded-md bg-off-white px-3 py-1 text-xs text-muted-foreground">launchyournextchapter.com/hub/{p.slug}</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 bg-navy px-5 py-3 text-white">
            <p className="font-serif text-lg font-semibold">{p.name} <span className="font-sans text-sm font-normal text-white/70">Career hub</span></p>
            <p className="text-xs text-white/70">Powered by NextChapter</p>
          </div>
          <HubTabs tabs={tabs} />
        </div>
      </Section>

      <Section eyebrow="Why now" title="Hiring is open, and searches are long">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <LongSearchCard />
          <div className="rounded-2xl border border-border bg-white p-5 text-sm text-muted-foreground">
            {p.kind === 'employer' && <><p className="font-semibold text-navy">What Brown-Forman announced in January 2025</p><ul className="mt-2 list-inside list-disc space-y-1"><li>A reduction of about 12% of its global workforce: about 650 of 5,400 employees</li><li>The closure of its Louisville cooperage, about 210 roles</li><li>Severance, outplacement and benefits for those affected</li></ul><p className="mt-2 text-xs">From <a className="underline underline-offset-4" href="https://www.businesswire.com/news/home/20250114888794/en" target="_blank" rel="noopener noreferrer">Brown-Forman&apos;s release</a>. Outplacement typically runs about 90 days; many of these searches ran longer.</p></>}
            {p.kind === 'talent' && <p>The Greater Louisville workforce area grew 2.1% from 2020 to 2024 (Census estimates), against 7.0% for Northern Middle Tennessee. Every professional who leaves for a faster-growing metro after a layoff is a loss Live in Lou then has to win back. Its goal is to add 41,000 working-age people to the region by 2030 (<a className="underline underline-offset-4" href="https://greaterlouisvillepartnership.com/talent-attraction-retention-development" target="_blank" rel="noopener noreferrer">Greater Louisville Inc.</a>).</p>}
            {p.kind === 'college' && college && <p>W&amp;J enrolls about {n0(college.enrollment ?? 0)} students in {college.city}, and we estimate about {n0(college.alumniEstimate ?? 0)} living alumni (our estimate from enrollment and completions, not a count you gave us). Alumni in the region are the ones layoffs reach first.</p>}
          </div>
        </div>
      </Section>

      <Section id="activate" eyebrow="Get started" title={`Activate this page for ${p.name}`}>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          <div className="space-y-3 text-muted-foreground">
            <p>{p.claimLine}</p>
            <ul className="list-inside list-disc space-y-1 text-sm">
              <li>Takes about a minute. Nothing is created until you confirm.</li>
              <li>Free for the people you refer.</li>
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
