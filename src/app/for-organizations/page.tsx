import Link from 'next/link'
import type { Metadata } from 'next'
import { Building2, Users, Briefcase, Landmark, GraduationCap, HeartHandshake, type LucideIcon } from 'lucide-react'
import { Logo } from '@/components/Logo'
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
    href: '/employers',
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
    href: '/for-coaches',
    title: 'Coaches',
    teaser: 'Bring your clients onto a platform built for their search.',
    icon: HeartHandshake,
    accent: 'text-brand bg-brand/10',
  },
]

export default function ForOrganizationsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
          <Link href="/">
            <Logo className="text-2xl" />
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/" className="text-muted-foreground hover:text-foreground">
              For candidates
            </Link>
            <details className="group relative">
              <summary className="cursor-pointer list-none rounded-md border border-border px-3 py-1.5 font-medium text-foreground marker:content-none hover:border-brand hover:text-brand">
                Log in
              </summary>
              <div className="absolute right-0 z-10 mt-2 w-44 rounded-md border border-border bg-white py-1 shadow-md">
                <Link
                  href="/talent/login"
                  className="block px-3 py-2 text-sm text-foreground hover:bg-off-white"
                >
                  Employers
                </Link>
                <Link
                  href="/recruiters/login"
                  className="block px-3 py-2 text-sm text-foreground hover:bg-off-white"
                >
                  Recruiters &amp; Agencies
                </Link>
                <Link
                  href="/support/coach/login"
                  className="block px-3 py-2 text-sm text-foreground hover:bg-off-white"
                >
                  Coaches
                </Link>
              </div>
            </details>
          </nav>
        </div>
      </header>

      <div className="border-b border-border bg-gradient-to-br from-navy to-brand">
        <main className="mx-auto w-full max-w-5xl px-6 py-16">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            For organizations
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/80">
            NextChapter is a candidate-first platform that helps people get back to work — and a
            partner to the organizations that hire, place, fund, and serve them. Choose your path
            below.
          </p>
        </main>
      </div>

      <main className="mx-auto w-full max-w-5xl px-6 py-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {ORG_CARDS.map((card) => {
            const Icon = card.icon
            return (
              <Link key={card.href} href={card.href}>
                <Card className="h-full border-border transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <CardContent className="pt-6">
                    <div
                      className={cn(
                        'flex size-11 items-center justify-center rounded-lg',
                        card.accent
                      )}
                    >
                      <Icon className="size-5" />
                    </div>
                    <h2 className="mt-4 font-semibold text-navy">{card.title}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">{card.teaser}</p>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </main>
    </div>
  )
}
