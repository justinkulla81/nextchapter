import Link from 'next/link'
import type { Metadata } from 'next'
import { Building2, Users, Landmark, GraduationCap, HeartHandshake, ChevronDown, type LucideIcon } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { ContactForm } from '@/components/marketing/ContactForm'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'For Organizations and Coaches',
  description:
    'What NextChapter gives employers, recruiters, coaches, colleges, nonprofits and workforce agencies, in plain terms. Free for the people you serve.',
  alternates: { canonical: '/for-organizations' },
  openGraph: {
    title: 'For Organizations and Coaches — NextChapter',
    description: 'What NextChapter gives employers, recruiters, coaches, colleges, nonprofits and workforce agencies, in plain terms.',
    url: 'https://launchyournextchapter.com/for-organizations',
  },
}

// One card per kind of partner: who it's for, exactly what they get, where to
// read more and where to log in. Employers have four programs on one account.
type Partner = {
  id: string
  title: string
  who: string
  icon: LucideIcon
  accent: string
  gets: string[]
  learnMore: { href: string; label: string }
  login: { href: string; label: string } | null
}

const EMPLOYER_PROGRAMS: { title: string; who: string; gets: string; href: string }[] = [
  {
    title: 'Hiring',
    who: 'Filling roles',
    gets: 'Post a role, see matched candidates who chose to be seen, and ask for introductions.',
    href: '/talent',
  },
  {
    title: 'Outplacement',
    who: 'People leaving',
    gets: 'A seat for each person: job-search tools, coaching and a recruiter network. You see participation and outcomes as counts.',
    href: '/outplacement',
  },
  {
    title: 'Growth',
    who: 'People staying',
    gets: 'Review and raise prep, promotion plans, and internal roles only your people see. You see counts by team, never who.',
    href: '#contact',
  },
  {
    title: 'Learning',
    who: 'People staying',
    gets: 'A skills plan for each person’s role and next role, with the courses you cover first. You see how many started and finished.',
    href: '#contact',
  },
]

const PARTNERS: Partner[] = [
  {
    id: 'recruiters',
    title: 'Recruiters and agencies',
    who: 'Search firms, staffing agencies and in-house sourcers.',
    icon: Users,
    accent: 'text-light-blue bg-light-blue/10',
    gets: [
      'Search candidates who opted in to be found, with their resume and work history.',
      'A resume page in your logo, with each resume routed to the right recruiter.',
      'Candidates who arrive with their file already built.',
    ],
    learnMore: { href: '/recruiters', label: 'For recruiters' },
    login: { href: '/recruiters/login', label: 'Recruiter log in' },
  },
  {
    id: 'coaches',
    title: 'Coaches',
    who: 'Independent career coaches and coaching practices. No organization needed.',
    icon: HeartHandshake,
    accent: 'text-brand bg-brand/10',
    gets: [
      'Invite your clients with a code; you keep billing them your way.',
      'See the plan, applications and progress each client chooses to share, before every session.',
      'Track sessions left and share your scheduling link.',
    ],
    learnMore: { href: '/coaches', label: 'For coaches' },
    login: { href: '/support/coach/login', label: 'Coach log in' },
  },
  {
    id: 'colleges',
    title: 'Colleges and nonprofits',
    who: 'Alumni relations, career services, development and mission-driven programs.',
    icon: GraduationCap,
    accent: 'text-success bg-success/10',
    gets: [
      'A workspace for your alumni or participants, in your colors.',
      'Outcomes reporting in counts, with small groups held back.',
      'Mentors, employer partners and jobs posted only for your people.',
    ],
    learnMore: { href: '/nonprofits', label: 'For colleges and nonprofits' },
    login: null,
  },
  {
    id: 'workforce',
    title: 'Government and workforce',
    who: 'Workforce boards, economic development groups, chambers and state agencies.',
    icon: Landmark,
    accent: 'text-navy bg-navy/10',
    gets: [
      'A program workspace for job seekers in your region.',
      'A layoff response sign-up page for workers affected by a layoff in your area.',
      'Your member companies, with hiring and outplacement seats you can sponsor.',
    ],
    learnMore: { href: '/government-workforce', label: 'For government and workforce' },
    login: null,
  },
]

const LOGINS: { href: string; label: string }[] = [
  { href: '/talent/login', label: 'Employers: hiring' },
  { href: '/employer/login', label: 'Employers: outplacement, growth and learning' },
  { href: '/recruiters/login', label: 'Recruiters' },
  { href: '/support/coach/login', label: 'Coaches' },
]

function Gets({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
      {items.map((g) => (
        <li key={g} className="flex gap-2">
          <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />
          <span>{g}</span>
        </li>
      ))}
    </ul>
  )
}

export default function ForOrganizationsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <section className="relative bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <Link href="/">
            <Logo className="text-3xl" />
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/" className="hidden text-sm font-medium text-muted-foreground hover:text-foreground sm:inline-block">
              For candidates
            </Link>
            <details className="group relative">
              <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-muted-foreground marker:content-none hover:text-foreground">
                Log in
                <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <div className="absolute right-0 z-10 mt-2 w-72 rounded-md border border-border bg-white py-1 shadow-md">
                {LOGINS.map((l) => (
                  <Link key={l.href} href={l.href} className="block px-3 py-2 text-sm text-foreground hover:bg-off-white">
                    {l.label}
                  </Link>
                ))}
              </div>
            </details>
          </nav>
        </div>

        <div className="mx-auto max-w-4xl px-6 pt-16 pb-16 text-center">
          <p className="text-sm font-semibold tracking-wide text-brand uppercase">For organizations and coaches</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-navy sm:text-6xl">Work with NextChapter</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Find yourself below and see exactly what you get. NextChapter is always free for the people you serve; you pay for the program and reporting on top.
          </p>
          <nav aria-label="Jump to" className="mt-8 flex flex-wrap justify-center gap-2 text-sm">
            {[{ id: 'employers', title: 'Employers' }, ...PARTNERS].map((p) => (
              <a key={p.id} href={`#${p.id}`} className="rounded-full border border-border px-3 py-1.5 font-medium text-navy hover:border-brand hover:text-brand">
                {p.title}
              </a>
            ))}
          </nav>
        </div>

        <div className="h-1.5 w-full bg-orange" />
      </section>

      {/* Employers: four programs, one account. */}
      <section id="employers" aria-labelledby="employers-title" className="scroll-mt-6 bg-off-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex items-start gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <Building2 className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="employers-title" className="text-2xl font-bold tracking-tight text-navy">
                Employers
              </h2>
              <p className="mt-1 max-w-3xl text-muted-foreground">
                Companies of any size. Four programs on one employer account: hire, help people leaving, and keep and grow the people staying.
              </p>
            </div>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {EMPLOYER_PROGRAMS.map((p) => (
              <Link key={p.title} href={p.href} className="group block h-full rounded-xl border border-light-gray bg-white p-5 transition-colors hover:border-brand">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{p.who}</p>
                <h3 className="mt-1 font-semibold text-navy group-hover:text-brand">{p.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{p.gets}</p>
              </Link>
            ))}
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Whatever the program, your people’s activity stays private to them. You see counts across a group, and a name only when someone chooses to share it,
            such as raising a hand for an internal role.{' '}
            <a href="#contact" className="font-medium text-brand underline underline-offset-4">
              Ask about Growth or Learning
            </a>
          </p>
        </div>
      </section>

      {PARTNERS.map((p, i) => {
        const Icon = p.icon
        return (
          <section key={p.id} id={p.id} aria-labelledby={`${p.id}-title`} className={cn('scroll-mt-6 py-16', i % 2 === 0 ? 'bg-white' : 'bg-off-white')}>
            <div className="mx-auto grid max-w-6xl gap-6 px-6 md:grid-cols-[1fr_auto] md:items-start">
              <div className="flex items-start gap-4">
                <div className={cn('flex size-11 shrink-0 items-center justify-center rounded-lg', p.accent)}>
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 id={`${p.id}-title`} className="text-2xl font-bold tracking-tight text-navy">
                    {p.title}
                  </h2>
                  <p className="mt-1 text-muted-foreground">{p.who}</p>
                  <Gets items={p.gets} />
                </div>
              </div>
              <div className="flex gap-4 text-sm md:flex-col md:items-end md:pt-2">
                <Link href={p.learnMore.href} className="font-medium text-brand underline underline-offset-4">
                  {p.learnMore.label} →
                </Link>
                {p.login && (
                  <Link href={p.login.href} className="text-muted-foreground hover:text-foreground">
                    {p.login.label}
                  </Link>
                )}
              </div>
            </div>
          </section>
        )
      })}

      <section id="contact" className="scroll-mt-6 bg-navy py-16">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-2xl font-bold tracking-tight text-white">Talk to us</h2>
          <p className="mt-2 mb-6 text-light-blue">
            Not sure which fits, or want Growth or Learning for your company? Tell us what you’re trying to do. We reply within one business day. Or read the monthly{' '}
            <Link href="/reports/latest" className="text-white underline underline-offset-4">
              White Collar Employment Report
            </Link>{' '}
            for the data behind it.
          </p>
          <div className="rounded-xl border border-border bg-white p-6 sm:p-8">
            <ContactForm initialAudience="ORGANIZATION" source="organizations" />
          </div>
        </div>
      </section>
    </div>
  )
}
