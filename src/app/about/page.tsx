import fs from 'node:fs'
import path from 'node:path'
import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { StructuredData } from '@/components/StructuredData'
import { PublicSiteHeader, PublicSiteFooter } from '@/components/marketing/PublicSiteChrome'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { COMPANY_LINKEDIN_URL, FOUNDER_LINKEDIN_URL } from '@/lib/contact/constants'

const TITLE = 'About: the AI platform for career transitions'
const DESCRIPTION =
  'NextChapter is the AI platform for career transitions. Founded by Justin Kulla, an education technology founder, operator and investor. MIT, Harvard, Carnegie Mellon.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/about' },
  openGraph: { title: 'About NextChapter: the AI platform for career transitions', description: DESCRIPTION, url: 'https://launchyournextchapter.com/about' },
}

// Drop a square-ish headshot at public/images/team/justin-kulla.jpg and the
// founder section uses it; until then it shows initials.
const PHOTO_PATH = '/images/team/justin-kulla.jpg'
const hasPhoto = fs.existsSync(path.join(process.cwd(), 'public', PHOTO_PATH))

const founderJsonLd = {
  '@type': 'Person',
  name: 'Justin Kulla',
  jobTitle: 'Founder & CEO',
  url: FOUNDER_LINKEDIN_URL,
  sameAs: [FOUNDER_LINKEDIN_URL],
  alumniOf: [
    { '@type': 'CollegeOrUniversity', name: 'Massachusetts Institute of Technology' },
    { '@type': 'CollegeOrUniversity', name: 'Harvard University' },
    { '@type': 'CollegeOrUniversity', name: 'Carnegie Mellon University' },
  ],
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'NextChapter',
  url: 'https://launchyournextchapter.com',
  description: 'The AI platform for career transitions.',
  sameAs: [COMPANY_LINKEDIN_URL],
  founder: founderJsonLd,
  knowsAbout: [
    'AI job search', 'Career transitions', 'Career exploration', 'Career pathways',
    'Education technology', 'Retraining', 'Workforce development', 'AI displacement',
    'Long-term unemployment', 'Age-related unemployment', 'Parental and family leave',
  ],
}

const TERMS = ['AI job search', 'Career transitions', 'Career exploration', 'Career pathways', 'Education & retraining', 'Workforce development']

const PILLARS = [
  { kicker: 'AI job search', title: 'AI agents run the search', body: 'They find matching roles, track every application, response and rejection, and tell you what to do next.' },
  { kicker: 'Career exploration', title: 'Know which jobs you can get', body: 'The Market Reality Grade shows how employers read your background and which roles and titles fit.' },
  { kicker: 'Education & retraining', title: 'Train only where it pays off', body: 'Career pathways that show the skills and credentials employers are hiring for, and nothing extra.' },
  { kicker: 'Workforce development', title: 'Move people into jobs at scale', body: 'Outplacement firms, workforce boards, nonprofits and employers manage cohorts and report placement results.' },
]

const CANDIDATES = [
  'Laid off, or watching AI change your job',
  'Out of work for six months or more',
  'Experienced, and hearing “overqualified”',
  'Returning from parental or family leave',
  'Exploring a real career change',
]

const ORGANIZATIONS: { label: string; href: string }[] = [
  { label: 'Outplacement and career transition firms', href: '/outplacement' },
  { label: 'Government workforce boards', href: '/government-workforce' },
  { label: 'Nonprofits and training providers', href: '/nonprofits' },
  { label: 'Employers and HR teams', href: '/employers' },
  { label: 'Career coaches and recruiters', href: '/for-coaches' },
]

const DEGREES = [
  { school: 'MIT Sloan', degree: 'MBA' },
  { school: 'Harvard Kennedy School', degree: 'Master of Public Administration' },
  { school: 'Carnegie Mellon', degree: 'MS, Information Systems Management' },
]

const RECORD = [
  { k: 'Founder', v: 'NextChapter · BusinessBlocks (acquired by AmTrust Financial)' },
  { k: 'Investor', v: 'Partner, TZP Group, impact and education · Founding member, Weld North' },
  { k: 'Operator', v: 'SVP, Global M&A and Venture Investments, AmTrust Financial · CTO, Edgenuity' },
]

const INVESTMENTS = ['Imagine Learning', 'The Learning House', 'Performance Matters', 'Edgenuity']

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <rect width="24" height="24" rx="4" fill="#0a66c2" />
      <path fill="#fff" d="M7.1 9.6h2.3V17H7.1zM8.2 6a1.3 1.3 0 1 1 0 2.7 1.3 1.3 0 0 1 0-2.7zm2.6 3.6H13v1c.3-.6 1.1-1.2 2.3-1.2 2.4 0 2.9 1.6 2.9 3.7V17h-2.3v-3.5c0-.8 0-1.9-1.2-1.9s-1.4.9-1.4 1.8V17h-2.3z" />
    </svg>
  )
}

const EYEBROW = 'text-xs font-bold uppercase tracking-[0.1em] text-brand'
const H2 = 'mt-2 max-w-2xl text-balance text-2xl font-bold tracking-tight text-navy sm:text-3xl'

export default function AboutPage() {
  return (
    <div className="flex flex-1 flex-col bg-white">
      <StructuredData data={jsonLd} />
      <PublicSiteHeader current="about" />

      <main>
        {/* What NextChapter is */}
        <section className="bg-gradient-to-b from-off-white to-white">
          <div className="mx-auto max-w-6xl px-6 pt-16 pb-16 sm:pt-20">
            <p className={EYEBROW}>About NextChapter</p>
            <h1 className="mt-3 max-w-3xl text-balance text-4xl font-bold tracking-tight text-navy sm:text-6xl">
              The AI platform for career transitions
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
              NextChapter gets people back to work faster. Our AI runs the job search, shows people which careers fit,
              and points them to the retraining that actually gets them hired. Employers, workforce boards and
              outplacement firms use NextChapter to move their people into new jobs at scale.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <TrackedLink
                href="/onboarding/desire"
                event="about_cta_clicked"
                properties={{ cta: 'hero_start', audience: 'candidate' }}
                className="inline-flex items-center justify-center rounded-lg bg-success px-5 py-3 text-sm font-semibold text-white hover:bg-success-hover"
              >
                Start your next chapter
              </TrackedLink>
              <TrackedLink
                href="/contact?as=organization"
                event="about_cta_clicked"
                properties={{ cta: 'hero_work_with_us', audience: 'organization' }}
                className="inline-flex items-center justify-center rounded-lg border border-light-gray bg-white px-5 py-3 text-sm font-semibold text-navy hover:bg-off-white"
              >
                Work with us
              </TrackedLink>
            </div>
            <ul className="mt-8 flex flex-wrap gap-2" aria-label="What we work on">
              {TERMS.map((t) => (
                <li key={t} className="rounded-full border border-light-gray bg-white px-3 py-1 text-xs text-muted-foreground">{t}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* The problem */}
        <section>
          <div className="mx-auto max-w-6xl px-6 py-16">
            <p className={EYEBROW}>The problem</p>
            <h2 className={H2}>Losing a job is common. Finding the next one takes too long.</h2>
            <div className="mt-4 max-w-2xl space-y-4 text-base leading-relaxed text-foreground/85">
              <p>
                AI is eliminating and reshaping jobs across entire industries. People who are out of work for six months
                or more find it harder to get hired with every month that passes. Workers over 50 face age-related
                unemployment. Parents returning from parental and family leave have to explain the gap on their résumé.
              </p>
              <p>
                Most career help is a résumé review and a few coaching calls. It doesn’t tell people which jobs they can
                actually get, what training is worth their time, or how to run a search that produces interviews.
                NextChapter does.
              </p>
            </div>
          </div>
        </section>

        {/* What we do */}
        <section className="bg-off-white">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <p className={EYEBROW}>What we do</p>
            <h2 className={H2}>AI, career education and workforce tools in one platform</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PILLARS.map((p) => (
                <div key={p.kicker} className="rounded-xl border border-light-gray bg-white p-5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-light-blue">{p.kicker}</p>
                  <h3 className="mt-2 text-base font-semibold text-navy">{p.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Who we serve */}
        <section>
          <div className="mx-auto max-w-6xl px-6 py-16">
            <p className={EYEBROW}>Who we serve</p>
            <h2 className={H2}>People in transition, and the organizations behind them</h2>
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              <div className="rounded-xl border border-orange/40 bg-orange/5 p-6">
                <h3 className="text-lg font-semibold text-navy">For people in transition</h3>
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-foreground/85">
                  {CANDIDATES.map((c) => <li key={c}>{c}</li>)}
                </ul>
                <p className="mt-4 text-sm text-muted-foreground">
                  Candidates are never charged.{' '}
                  <Link href="/how-it-works" className="font-medium text-brand underline underline-offset-4">How it works</Link>
                </p>
              </div>
              <div className="rounded-xl border border-brand/20 bg-brand/5 p-6">
                <h3 className="text-lg font-semibold text-navy">For organizations</h3>
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-foreground/85">
                  {ORGANIZATIONS.map((o) => (
                    <li key={o.label}><Link href={o.href} className="hover:text-brand hover:underline">{o.label}</Link></li>
                  ))}
                </ul>
                <p className="mt-4 text-sm text-muted-foreground">
                  <Link href="/for-organizations" className="font-medium text-brand underline underline-offset-4">For organizations</Link>
                  {' · '}
                  <Link href="/security" className="font-medium text-brand underline underline-offset-4">Security</Link>
                  {' · '}
                  <TrackedLink href="/contact?as=organization" event="about_cta_clicked" properties={{ cta: 'serve_talk_to_us', audience: 'organization' }} className="font-medium text-brand underline underline-offset-4">
                    Talk to us
                  </TrackedLink>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Founder */}
        <section className="bg-off-white" aria-labelledby="founder">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <p className={EYEBROW}>Founder</p>
            <div className="mt-6 grid gap-8 md:grid-cols-[220px_minmax(0,1fr)]">
              <div className="max-w-[220px]">
                {hasPhoto ? (
                  <Image
                    src={PHOTO_PATH}
                    alt="Justin Kulla"
                    width={440}
                    height={550}
                    className="aspect-[4/5] w-full rounded-2xl object-cover"
                    priority={false}
                  />
                ) : (
                  <div className="grid aspect-[4/5] w-full place-items-center rounded-2xl bg-navy text-5xl font-bold tracking-tight text-white" aria-hidden="true">
                    JK
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <h2 id="founder" className="text-2xl font-bold tracking-tight text-navy">Justin Kulla</h2>
                <p className="mt-1 text-sm text-muted-foreground">Founder &amp; CEO, NextChapter</p>
                <TrackedLink
                  href={FOUNDER_LINKEDIN_URL}
                  event="founder_linkedin_clicked"
                  properties={{ page: 'about' }}
                  className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-brand hover:underline"
                >
                  <LinkedInIcon /> Justin on LinkedIn
                </TrackedLink>

                <div className="mt-6 max-w-2xl space-y-4 text-base leading-relaxed text-foreground/85">
                  <p>Justin has spent nearly 20 years as an investor, founder and operator in education technology.</p>
                  <p>
                    He founded BusinessBlocks, an education company for small businesses, and led it as CEO through a
                    successful exit to AmTrust Financial, a Fortune 500 company. At AmTrust he became SVP and Head of
                    Global M&amp;A and Venture Investments.
                  </p>
                  <p>
                    He is a Partner at TZP Group, where he leads impact and education investments. He was a founding
                    member of Weld North, where he invested in Imagine Learning, The Learning House and Performance
                    Matters, and served as CTO of Edgenuity. He started his career in technology at Credit Suisse and
                    Google.
                  </p>
                </div>

                <ul className="mt-6 grid gap-3 sm:grid-cols-3" aria-label="Education">
                  {DEGREES.map((d) => (
                    <li key={d.school} className="rounded-xl border border-light-gray bg-white px-4 py-3">
                      <span className="block text-sm font-semibold text-navy">{d.school}</span>
                      <span className="text-xs text-muted-foreground">{d.degree}</span>
                    </li>
                  ))}
                </ul>

                <dl className="mt-6 max-w-2xl divide-y divide-light-gray border-y border-light-gray">
                  {RECORD.map((r) => (
                    <div key={r.k} className="grid gap-1 py-3 text-sm sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-4">
                      <dt className="pt-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-gray">{r.k}</dt>
                      <dd className="text-foreground/85">{r.v}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-6">
                  <p className="text-sm font-semibold text-navy">Education investments</p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {INVESTMENTS.map((i) => (
                      <li key={i} className="rounded-md border border-light-gray bg-white px-3 py-1.5 text-sm font-semibold text-navy">{i}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Follow */}
        <section>
          <div className="mx-auto max-w-6xl px-6 py-12">
            <div className="flex flex-col gap-4 rounded-xl border border-light-gray p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-navy">Follow NextChapter</p>
                <p className="text-sm text-muted-foreground">Product news and hiring-market updates.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <TrackedLink
                  href={COMPANY_LINKEDIN_URL}
                  event="company_linkedin_clicked"
                  properties={{ page: 'about', placement: 'follow' }}
                  className="inline-flex items-center gap-2 rounded-lg border border-light-gray px-4 py-2 text-sm font-semibold text-navy hover:bg-off-white"
                >
                  <LinkedInIcon /> NextChapter on LinkedIn
                </TrackedLink>
                <TrackedLink
                  href="/contact"
                  event="about_cta_clicked"
                  properties={{ cta: 'follow_contact' }}
                  className="inline-flex items-center rounded-lg border border-light-gray px-4 py-2 text-sm font-semibold text-navy hover:bg-off-white"
                >
                  Contact us
                </TrackedLink>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicSiteFooter page="about" />
    </div>
  )
}
