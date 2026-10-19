import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { StructuredData } from '@/components/StructuredData'
import { StatCallouts } from '@/components/StatCallouts'
import { CompetencyGridVisual } from '@/components/marketing/CompetencyGridVisual'
import { SampleMarketRealityReport } from '@/components/marketing/SampleMarketRealityReport'
import { AudienceRouter } from '@/components/marketing/AudienceRouter'
import { SiteNav } from '@/components/marketing/PublicSiteChrome'
import { PERSONAS } from '@/lib/constants/personas'
import { GUIDE_LANDING_CONTENT } from '@/lib/constants/guide-landing-content'
import { HomepageJobBoard } from '@/components/home/HomepageJobBoard'
import { NewsFeed } from '@/components/news/NewsFeed'
import { NewsletterSignup } from '@/components/marketing/NewsletterSignup'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { getPublishedNews } from '@/lib/news/published'
import { canonical } from '@/lib/seo/canonical'
import { HERO_STATS } from '@/lib/marketing/hero-stats'
import { organizationJsonLd, organizationRef } from '@/lib/seo/jsonld'

// The page is otherwise static. Publishing News in the admin clears it at
// once; the timer is the fallback.
export const revalidate = 300

export const metadata = canonical('/')

const HOMEPAGE_NEWS_COUNT = 6

// Partners Master Build Script §C3.1 — homepage restructured to the spec's
// exact 8-part order: hero -> the problem in one screen -> the three beats
// -> proof of the diagnosis -> the Dossier -> "Free, always" -> audience
// router -> waitlist/signup. Existing high-value content (heroStats,
// "which one sounds like you," the STUCK_TO_FIX table, the how-it-works
// steps, and the guide links) is folded in around that spine rather than
// deleted — this is a restructure, not a rebuild.
const HOMEPAGE_STATS = [
  { value: '15', label: 'Free expert guides' },
  { value: 'Free', label: 'For candidates, always' },
  { value: '4', label: 'Step verified process' },
]

// The coach is only as good as what it can see. These are the four streams it
// reads, and what each makes possible.
const COACH_DATA = [
  { title: 'Your work', body: 'Your résumé, references, work samples and Executive Dossier: the proof of what you have done.' },
  { title: 'Your applications', body: 'Connect Gmail and Calendar and your applications, interviews and follow-ups are tracked for you.' },
  { title: 'Your networking', body: 'Your contacts, outreach and replies, plus the colleges, recruiters and communities you are part of.' },
  { title: 'Your learning', body: 'The skills you have, the ones worth building, and the courses and coaching you finish.' },
]

// When a search runs long the plan changes, not just the wording of a reminder.
const WHEN_STUCK = [
  { when: 'Week 3', body: 'Applications but no interviews: we run the résumé against the roles you want.' },
  { when: 'Week 6', body: 'Still nothing: widen the targets and bring in interim or fractional work.' },
  { when: 'Week 9', body: 'A human coach reviews what is not working, and someone who hires critiques your pitch.' },
  { when: 'Week 13', body: 'Test a different lane, and check your runway so you can choose with a clear head.' },
]

const THREE_BEATS = [
  {
    title: 'Know where you stand.',
    body: 'A Market Reality Assessment that tells you how hard this search will be and which of the five things driving it are in your control. Not a judgment of your career — an estimate of the work ahead.',
    href: '/why-stuck',
    cta: 'See the full picture →',
  },
  {
    title: "Fix what's fixable.",
    body: 'Your resume tested against the eleven systems that actually read it. Every issue, with the fix, in about twenty minutes.',
    href: '/how-it-works',
    cta: 'See how it works →',
  },
  {
    title: "Build what your resume can't say.",
    body: 'Three references, structured and scored. A skills and personality assessment for better job matches. One Executive Dossier you keep forever.',
    href: '/dossier',
    cta: 'See a sample Dossier →',
  },
]

const HOW_IT_WORKS_STEPS = [
  { title: 'Market Reality Assessment', description: 'A clearer view of where you stand and what to do next.' },
  { title: 'Weekly plan', description: 'A weekly plan for where you are: searching, preparing, or managing your career in the job you have.' },
  { title: 'Weekly score', description: 'Momentum you can actually see, points that never feel abstract.' },
  { title: 'Executive Dossier', description: 'Helps employers see what your résumé leaves out.' },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'NextChapter',
  url: 'https://launchyournextchapter.com',
  description:
    'A resume is the least complete thing about you. NextChapter turns a job search into verified evidence — a Market Reality Assessment, a Resume Studio, and an Executive Dossier corroborated by the people who worked with you. Free for candidates, always.',
  publisher: organizationRef(),
}

export default async function Home() {
  const news = await getPublishedNews(HOMEPAGE_NEWS_COUNT)
  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={jsonLd} />
      <StructuredData data={organizationJsonLd()} />

      {/* 1 — Hero (§C3.1.1) */}
      <section className="relative bg-white">
        <SiteNav />

        <div className="mx-auto max-w-4xl px-6 pt-16 pb-20 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-navy sm:text-6xl">
            The best coach you&apos;ve ever had, built on all your data.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Your résumé is the least complete thing about you. NextChapter&apos;s coach works from your
            work, your applications, your networking and your learning, and tailors every step to your
            job search strategy, whether you&apos;re out of work, thinking about a move, or growing in the job you have.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              nativeButton={false}
              size="lg"
              variant="cta"
              className="h-14 px-8 text-base"
              render={<Link href="/onboarding/desire" />}
            >
              Get Your Market Reality Assessment
            </Button>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Upload your resume and understand how hiring managers will evaluate it with your
            NextChapter Market Reality Assessment. Then get an action plan to increase your
            marketability.
          </p>
          <div className="mx-auto mt-12 max-w-2xl overflow-hidden rounded-xl border border-light-gray bg-white shadow-lg">
            <video
              controls
              // "none": "metadata" still pulled ~360 KB on load, delaying the
              // hero text (LCP) on mobile. The video loads when played.
              preload="none"
              className="w-full"
              src="https://uvoulytrsrxasqzutlmq.supabase.co/storage/v1/object/public/site-media/homepage-explainer.mp4"
            >
              Your browser doesn&apos;t support embedded video.
            </video>
          </div>

          <div className="mt-16 grid gap-4 sm:grid-cols-4">
            {HERO_STATS.map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-light-gray bg-off-white px-4 py-6 text-center"
              >
                <p className="text-2xl font-bold text-navy">{stat.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  <Link href={stat.sourceUrl} className="underline underline-offset-2">
                    {stat.source}
                  </Link>
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="h-1.5 w-full bg-orange" />
      </section>

      {/* 1b — Job board: search without an account, personalize with one */}
      <HomepageJobBoard />

      {/* 2 — The problem, in one screen (§C3.1.2) */}
      <section className="bg-off-white py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-navy">
            A hiring manager scores you on 15 things. Your resume can only speak to 2 of them.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            Five competencies, checked three ways each — by your references, by a skills and
            personality assessment, and by what you actually do. Here&apos;s what a resume alone
            actually covers.
          </p>
          <div className="mt-10">
            <CompetencyGridVisual />
          </div>
        </div>
      </section>

      {/* 3 — The three beats (§C2.1 / §C3.1.3) */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight text-navy">
            NextChapter closes that gap in three moves.
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {THREE_BEATS.map((beat) => (
              <div key={beat.title} className="rounded-xl border border-light-gray bg-white p-6 shadow-sm">
                <h3 className="font-semibold text-navy">{beat.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{beat.body}</p>
                <Link href={beat.href} className="mt-4 inline-block text-sm font-medium text-primary underline underline-offset-4">
                  {beat.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The coach that knows your whole search, and what changes when a search runs long. */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight text-navy">
            A coach that has read everything you have done.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
            Most coaches start from what you tell them in an hour. Victoria, NextChapter&apos;s AI coach, starts from your actual
            work, applications, networking and learning, so every plan, email and nudge fits your search and not a template. Direct
            when you want direct, gentle when you want gentle.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {COACH_DATA.map((d) => (
              <div key={d.title} className="rounded-xl border border-light-gray bg-white p-5 shadow-sm">
                <h3 className="font-semibold text-navy">{d.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{d.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-14 rounded-xl border border-light-gray bg-off-white p-6">
            <h3 className="text-xl font-semibold text-navy">Searching for too long? The plan changes.</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              A long search gets different things to try as the weeks pass, based on what is actually happening: no interviews, interviews
              but no offers, or a search that has not really started. Members who connect their accounts and do the work get the most.
            </p>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {WHEN_STUCK.map((w) => (
                <li key={w.when} className="text-sm">
                  <span className="font-semibold text-navy">{w.when}.</span>{' '}
                  <span className="text-muted-foreground">{w.body}</span>
                </li>
              ))}
            </ul>
            <Link href="/start/searching-too-long" className="mt-4 inline-block text-sm font-medium text-primary underline underline-offset-4">
              Been searching a while? Start here →
            </Link>
          </div>
        </div>
      </section>

      {/* Which one sounds like you — existing high-converting persona picker,
          kept as a bridge between the beats and the proof section. */}
      <section className="bg-off-white py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-navy">Which one sounds like you?</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Out of work, working and thinking about a move, or happy where you are and want to grow: there&apos;s a plan for each.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {PERSONAS.map((persona) => (
              <Link
                key={persona.slug}
                href={`/start/${persona.slug}`}
                className="group flex items-start justify-between gap-3 rounded-xl border border-light-gray bg-white p-6 text-left shadow-sm transition-all hover:border-brand hover:shadow-md"
              >
                <div>
                  <p className="font-semibold text-navy">{persona.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{persona.hook}</p>
                </div>
                <span
                  aria-hidden="true"
                  className="mt-1 shrink-0 text-lg text-brand transition-transform group-hover:translate-x-0.5"
                >
                  →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 4 — Proof of the diagnosis (§C3.1.4) */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-navy">A real report, not a description of one.</h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            This is the same component a candidate sees on their dashboard — fed with sample data for a
            fictional candidate so you can see exactly what you&apos;d get.
          </p>
          <div className="mt-10">
            <SampleMarketRealityReport />
          </div>
        </div>
      </section>

      {/* 5 — The Dossier (§C3.1.5) */}
      <section className="bg-off-white py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-navy">The Executive Dossier</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Five structured references. A skills and personality assessment for better job matches.
            One document, built once, that you control and keep forever — through this search and
            every one after it.
          </p>
          <div className="mt-6">
            <Button nativeButton={false} size="default" variant="outline" render={<Link href="/dossier" />}>
              See a sample Dossier
            </Button>
          </div>
        </div>
      </section>

      {/* 6 — "Free, always" (§C3.1.6) */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-navy">Free, always.</h2>
          <p className="mt-3 text-muted-foreground">
            The Market Reality Report, Resume Studio, your networking and job application CRM, a
            skills and personality assessment for better job matches, community, and company pages
            cost nothing — permanently, not a trial. Someone who just lost a job doesn&apos;t need a
            paywall, they need a plan.
          </p>
        </div>
      </section>

      {/* Scam watch — fake-recruiter protection */}
      <section className="bg-off-white py-16">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-navy">Fake recruiters, caught in minutes.</h2>
          <p className="mt-3 text-muted-foreground">
            Scammers pose as recruiters because job hunters are hopeful and in a hurry. Vic checks the recruiter emails in
            your connected Gmail and emails you right away when one looks fake, before you book the call or hand over
            your details.
          </p>
          <TrackedLink
            href="/scam-watch"
            event="homepage_cta_clicked"
            properties={{ cta: 'scam_watch_learn_more' }}
            className="mt-4 inline-block text-sm font-medium text-primary underline underline-offset-4"
          >
            See how scam watch works →
          </TrackedLink>
        </div>
      </section>

      {/* How it works — supplementary detail on the free product */}
      <section className="bg-off-white py-20">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight text-navy">A clear path, not a black hole.</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {HOW_IT_WORKS_STEPS.map((step, i) => (
              <div key={step.title} className="rounded-xl border border-light-gray bg-white p-6">
                <span className="text-xs font-semibold tracking-widest text-brand uppercase">Step {i + 1}</span>
                <h3 className="mt-1 font-semibold text-navy">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-10 max-w-3xl overflow-hidden rounded-xl border border-light-gray bg-white shadow-lg">
            <Image
              src="/marketing/success-dashboard.png"
              alt="NextChapter Success Dashboard showing a Market Reality Assessment of B, an A Weekly Search Score, a 12-day streak, and completed Search Actions with their point values"
              width={1040}
              height={815}
              sizes="(min-width: 768px) 768px, 100vw"
              className="w-full"
            />
          </div>

          <div className="mt-6 text-center">
            <Link href="/how-it-works" className="text-sm font-medium text-primary underline underline-offset-4">
              See how it works in full →
            </Link>
          </div>
        </div>
      </section>

      {/* 7 — Audience router (§C3.1.7) */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight text-navy">
            Hiring, recruiting, or coaching?
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">
            NextChapter isn&apos;t only for candidates. Find your path.
          </p>
          <div className="mt-10">
            <AudienceRouter />
          </div>
        </div>
      </section>

      <section className="bg-off-white py-16">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-navy">
            Someone you care about is going through this.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Give them a head start — NextChapter is free for candidates, always.
          </p>
          <div className="mt-6">
            <Button nativeButton={false} size="default" variant="outline" render={<Link href="/refer" />}>
              Refer someone
            </Button>
          </div>
        </div>
      </section>

      {/* News — fed from Market Pulse in the admin. Absent, not empty, when
          nothing is published. */}
      {news.length > 0 && (
        <section className="border-b border-border bg-white py-20" aria-labelledby="news-heading">
          <div className="mx-auto max-w-6xl px-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="news-heading" className="text-3xl font-bold tracking-tight text-navy">News</h2>
                <p className="mt-2 max-w-xl text-muted-foreground">
                  Articles, videos, podcasts and posts on the job market and searching for a job.
                </p>
              </div>
              <Link href="/news" className="text-sm font-medium text-primary underline underline-offset-4">
                See all news →
              </Link>
            </div>
            <div className="mt-10">
              <NewsFeed items={news} placement="home" />
            </div>
          </div>
        </section>
      )}

      <section className="bg-white py-16">
        <div className="mx-auto max-w-3xl px-6">
          <StatCallouts stats={HOMEPAGE_STATS} />
        </div>
      </section>

      <section className="bg-off-white py-10">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Guides</h2>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
            {GUIDE_LANDING_CONTENT.map((guide) => (
              <Link
                key={guide.slug}
                href={`/resources/${guide.slug}`}
                className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                {guide.title}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-white px-6 py-16">
        <NewsletterSignup source="home" />
      </section>

      {/* 8 — Waitlist / signup (§C3.1.8). The product is live for
          candidates, so per §C4.2 this is a direct signup CTA, not a
          waitlist — a waitlist for a free, already-live product is friction
          with no purpose. */}
      <footer className="bg-navy text-white">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <h2 className="text-3xl font-bold tracking-tight">Ready to start your next chapter?</h2>
          <p className="mx-auto mt-4 max-w-xl text-light-blue">
            Does something need to change? Are you ready to put in the work?
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              size="lg"
              variant="cta"
              className="h-auto max-w-full py-3 whitespace-normal"
              nativeButton={false}
              render={<Link href="/onboarding/desire" />}
            >
              Get your Market Reality Assessment and then action plan to start your next chapter
            </Button>
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-light-blue">
            <span className="font-medium">Hiring, recruiting, or coaching?</span>
            <Link href="/for-organizations" className="underline underline-offset-4">
              See how NextChapter works for organizations and coaches
            </Link>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-light-blue">
            <span className="font-medium">Already have a resume ready?</span>
            <Link href="/submit-resume" className="underline underline-offset-4">
              Get it in front of our recruiter network
            </Link>
          </div>
          <p className="mt-4 text-sm text-light-blue">
            © {new Date().getFullYear()} NextChapter. Candidates are never charged — ever.
            {' · '}
            <Link href="/about" className="underline underline-offset-4">
              About
            </Link>
            {' · '}
            <Link href="/contact" className="underline underline-offset-4">
              Contact
            </Link>
            {' · '}
            <Link href="/pricing" className="underline underline-offset-4">
              Pricing
            </Link>
            {' · '}
            <Link href="/security" className="underline underline-offset-4">
              Security
            </Link>
            {' · '}
            <Link href="/news" className="underline underline-offset-4">
              News
            </Link>
            {' · '}
            <Link href="/reports/latest" className="underline underline-offset-4">
              White Collar Employment Report
            </Link>
            {' · '}
            <Link href="/faq" className="underline underline-offset-4">
              FAQ
            </Link>
            {' · '}
            <Link href="/resources" className="underline underline-offset-4">
              Resources
            </Link>
            {' · '}
            <Link href="/editorial-standards" className="underline underline-offset-4">
              Editorial standards
            </Link>
            {' · '}
            <Link href="/privacy-policy" className="underline underline-offset-4">
              Privacy Policy
            </Link>
            {' · '}
            <Link href="/terms" className="underline underline-offset-4">
              Terms of Service
            </Link>
          </p>
        </div>
      </footer>
    </div>
  )
}
