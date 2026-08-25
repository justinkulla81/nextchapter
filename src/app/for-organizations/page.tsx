import Link from 'next/link'
import type { Metadata } from 'next'
import { Building2, Users, Briefcase, Landmark, GraduationCap, HeartHandshake, UserCheck, ChevronDown, ArrowRight, type LucideIcon } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'For Organizations — NextChapter',
  description:
    'Whether you hire, recruit, place, fund, or serve jobseekers, NextChapter partners with employers, agencies, and institutions. See how we work together.',
  alternates: { canonical: '/for-organizations' },
  openGraph: {
    title: 'For Organizations — NextChapter',
    description:
      'Whether you hire, recruit, place, fund, or serve jobseekers, NextChapter partners with employers, agencies, and institutions.',
    url: 'https://launchyournextchapter.com/for-organizations',
  },
}

const ORG_CARDS: {
  href: string
  title: string
  teaser: string
  icon: LucideIcon
  accent: string
}[] = [
  {
    // Points at Talent (post a role, hire our candidates directly) — not
    // /employers/outplacement, a different product (help departing
    // employees relaunch). This teaser has always described Talent's
    // pitch, so the two were mismatched until this fix.
    href: '/talent',
    title: 'Employers',
    teaser: 'Hire for how people actually work, at one flat price.',
    icon: Building2,
    accent: 'text-brand bg-brand/10',
  },
  {
    href: '/recruiters',
    title: 'Recruiters & Agencies',
    teaser: 'Source verified, opted-in talent the filters miss.',
    icon: Users,
    accent: 'text-light-blue bg-light-blue/10',
  },
  {
    href: '/outplacement',
    title: 'Outplacement & HR',
    teaser: 'Give departing employees a real relaunch.',
    icon: Briefcase,
    accent: 'text-orange bg-orange/10',
  },
  {
    href: '/government-workforce',
    title: 'Government & Workforce',
    teaser: 'Help the people you serve get back to work faster.',
    icon: Landmark,
    accent: 'text-navy bg-navy/10',
  },
  {
    href: '/nonprofits',
    title: 'Nonprofits & Academia',
    teaser: 'Partner on the mission, and on the research.',
    icon: GraduationCap,
    accent: 'text-success bg-success/10',
  },
  {
    href: '/coaches',
    title: 'Coaches',
    teaser: 'Stop rebuilding context before every session.',
    icon: HeartHandshake,
    accent: 'text-brand bg-brand/10',
  },
  {
    href: '/hiring',
    title: 'Hiring Managers',
    teaser: 'Interview better, not longer.',
    icon: UserCheck,
    accent: 'text-accent-hiring bg-accent-hiring/10',
  },
]

const WHY_PARTNER = [
  {
    title: "They leave with something durable.",
    body: 'Not a login that expires — a verified Executive Dossier, references, and a membership that outlasts any contract or engagement.',
  },
  {
    title: 'You see what&apos;s actually happening.',
    body: 'Live utilization and aggregate outcomes for your program, not a quarterly PDF you have to chase down.',
  },
  {
    title: 'Free for the people you serve.',
    body: 'The core candidate platform is free, always — your organization pays for the reporting, compliance, and program layer on top of it.',
  },
]

export default function ForOrganizationsPage() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Hero — same header/hero pattern as the candidate homepage
          (src/app/page.tsx): white header with nav + Log in, centered bold
          navy headline, muted subhead, orange accent rule at the base. */}
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
              <div className="absolute right-0 z-10 mt-2 w-48 rounded-md border border-border bg-white py-1 shadow-md">
                {/* Each entry routes to the SAME login the matching tile
                    below links to — e.g. "Employers" here must land on the
                    same portal as the "Employers" card, not a different,
                    unrelated one. */}
                <Link href="/talent/login" className="block px-3 py-2 text-sm text-foreground hover:bg-off-white">
                  Employers
                </Link>
                <Link href="/employer/login" className="block px-3 py-2 text-sm text-foreground hover:bg-off-white">
                  Outplacement &amp; HR
                </Link>
                <Link href="/recruiters/login" className="block px-3 py-2 text-sm text-foreground hover:bg-off-white">
                  Recruiters &amp; Agencies
                </Link>
                <Link href="/support/coach/login" className="block px-3 py-2 text-sm text-foreground hover:bg-off-white">
                  Coaches
                </Link>
                <Link href="/hiring/login" className="block px-3 py-2 text-sm text-foreground hover:bg-off-white">
                  Hiring Managers
                </Link>
              </div>
            </details>
          </nav>
        </div>

        <div className="mx-auto max-w-4xl px-6 pt-16 pb-20 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-navy sm:text-6xl">For organizations</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            NextChapter is a candidate-first platform that helps people get back to work — and a partner to
            the organizations that hire, place, fund, and serve them. Choose your path below.
          </p>
        </div>

        <div className="h-1.5 w-full bg-orange" />
      </section>

      {/* Org-type picker */}
      <section className="bg-off-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {ORG_CARDS.map((card) => {
              const Icon = card.icon
              return (
                <Link key={card.href} href={card.href} className="group block h-full">
                  <Card className="h-full border-light-gray bg-white transition-colors group-hover:border-brand group-hover:shadow-md">
                    <CardContent className="pt-6">
                      <div className={cn('flex size-11 items-center justify-center rounded-lg', card.accent)}>
                        <Icon className="size-5" />
                      </div>
                      <h2 className="mt-4 flex items-center gap-1.5 font-semibold text-navy">
                        {card.title}
                        <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-brand" />
                      </h2>
                      <p className="mt-2 text-sm text-muted-foreground">{card.teaser}</p>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* Why partner with NextChapter — same 3-beat pattern as the
          candidate homepage's "three beats" section. */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-navy">Why organizations partner with us</h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            Every path above sits on the same free, candidate-first platform — what changes is the reporting
            and program layer built for your role.
          </p>
        </div>
        <div className="mx-auto mt-12 grid max-w-6xl gap-8 px-6 sm:grid-cols-3">
          {WHY_PARTNER.map((beat) => (
            <div key={beat.title} className="rounded-xl border border-light-gray bg-off-white p-6">
              <p className="font-semibold text-navy">{beat.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{beat.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-navy py-16 text-center text-white">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="text-2xl font-bold tracking-tight">Not sure which one fits?</h2>
          <p className="mt-2 text-light-blue">
            Start with Outplacement &amp; HR — most of what applies there (pricing, compliance, reporting)
            carries over to the other organization types.
          </p>
          <Button
            nativeButton={false}
            size="lg"
            variant="success"
            className="mt-6 h-12 px-8"
            render={<Link href="/outplacement" />}
          >
            See Outplacement &amp; HR →
          </Button>
        </div>
      </section>
    </div>
  )
}
