import Link from 'next/link'
import type { Metadata } from 'next'
import { ChevronDown } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { ContactForm } from '@/components/marketing/ContactForm'
import { OrganizationsHub } from '@/components/marketing/OrganizationsHub'

export const metadata: Metadata = {
  title: 'For Organizations and Coaches',
  description:
    'What NextChapter, the leading job transition platform, gives employers, recruiters, coaches, colleges, nonprofits and workforce agencies, in plain terms. Free for the people you serve.',
  alternates: { canonical: '/for-organizations' },
  openGraph: {
    title: 'For Organizations and Coaches — NextChapter',
    description: 'What NextChapter gives employers, recruiters, coaches, colleges, nonprofits and workforce agencies, in plain terms.',
    url: 'https://launchyournextchapter.com/for-organizations',
  },
}

const LOGINS: { href: string; label: string }[] = [
  { href: '/talent/login', label: 'Employers: hiring' },
  { href: '/employer/login', label: 'Employers: outplacement, growth and learning' },
  { href: '/recruiters/login', label: 'Recruiters' },
  { href: '/support/coach/login', label: 'Coaches' },
]

export default function ForOrganizationsPage() {
  return (
    <div className="theme-redesign flex flex-1 flex-col bg-white text-ink">
      <header>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <Link href="/" aria-label="NextChapter home">
            <Logo className="text-3xl" />
          </Link>
          <nav className="flex items-center gap-6" aria-label="Main">
            <Link href="/" className="hidden text-sm font-medium text-muted-foreground hover:text-ink sm:inline-block">
              For candidates
            </Link>
            <details className="group relative">
              <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-muted-foreground marker:content-none hover:text-ink">
                Log in
                <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <div className="absolute right-0 z-10 mt-2 w-72 rounded-xl border border-border bg-white py-1 shadow-md">
                {LOGINS.map((l) => (
                  <Link key={l.href} href={l.href} className="block px-3 py-2 text-sm hover:bg-muted">
                    {l.label}
                  </Link>
                ))}
              </div>
            </details>
          </nav>
        </div>
      </header>

      <OrganizationsHub />

      <section id="contact" className="scroll-mt-6 bg-ink py-16 text-white" aria-labelledby="org-contact-heading">
        <div className="mx-auto max-w-3xl px-6">
          <h2 id="org-contact-heading" className="font-display text-2xl font-semibold">
            Talk to us
          </h2>
          <p className="mt-2 mb-6 text-white/80">
            Not sure which fits, or want Growth or Learning for your company? Tell us what you’re trying to do. We reply within one business
            day. The data behind it is in the monthly{' '}
            <Link href="/reports/latest" className="underline underline-offset-4">
              White Collar Employment Report
            </Link>
            .
          </p>
          <div className="rounded-2xl border border-border bg-white p-6 text-ink sm:p-8">
            <ContactForm initialAudience="ORGANIZATION" source="organizations" />
          </div>
        </div>
      </section>
    </div>
  )
}
