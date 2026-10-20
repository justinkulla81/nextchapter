import type { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { cn } from '@/lib/utils'

// The one frame for every audience page (employers, recruiters, coaches, colleges, workforce,
// higher education membership). It carries the page contract from docs/candidate-redesign.md:
// one headline, one primary action, and everything else below it in at most three sections,
// with the rest folded under Disclosure. The page decides what goes inside; this decides
// how a visitor moves through it.

export const actionButton =
  'inline-flex h-14 items-center rounded-full bg-action px-8 text-base font-semibold text-action-foreground hover:brightness-95'

interface AudienceShellProps {
  page: string // analytics key, e.g. 'recruiters'
  parent?: { href: string; label: string }
  eyebrow: string
  headline: string
  subhead: string
  primary: { label: string; href: string }
  primaryNote?: string
  loginHref?: string
  footerLinks?: { href: string; label: string }[]
  children: ReactNode
}

export function AudienceShell({ page, parent, eyebrow, headline, subhead, primary, primaryNote, loginHref, footerLinks, children }: AudienceShellProps) {
  const crumb = parent ?? { href: '/for-organizations', label: 'For organizations' }
  return (
    <div className="theme-redesign flex flex-1 flex-col bg-white text-ink">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-5">
          <Link href="/" className="shrink-0" aria-label="NextChapter home">
            <Logo className="text-2xl" />
          </Link>
          <div className="order-2 flex shrink-0 items-center gap-4 sm:order-3">
            <Link href="/" className="text-sm text-muted-foreground hover:text-ink">
              For candidates
            </Link>
            {loginHref && (
              <Link href={loginHref} className="rounded-full border border-border px-4 py-1.5 text-sm font-semibold text-ink hover:bg-muted">
                Log in
              </Link>
            )}
          </div>
          <nav aria-label="Breadcrumb" className="order-3 flex min-w-0 basis-full items-center gap-1.5 text-sm sm:order-2 sm:basis-auto">
            <Link href={crumb.href} className="shrink-0 font-medium text-brand hover:underline">
              {crumb.label}
            </Link>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1 truncate font-medium sm:flex-none">{eyebrow}</span>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-3xl px-6 pt-14 pb-12 text-center" aria-labelledby="audience-heading">
          <p className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">{eyebrow}</p>
          <h1 id="audience-heading" className="mt-3 font-display text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
            {headline}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">{subhead}</p>
          <div className="mt-8">
            <TrackedLink href={primary.href} event="audience_cta_clicked" properties={{ page, cta: primary.label }} className={actionButton}>
              {primary.label}
            </TrackedLink>
          </div>
          {primaryNote && <p className="mt-3 text-sm text-muted-foreground">{primaryNote}</p>}
        </section>

        {children}
      </main>

      <footer className="mx-auto mt-auto w-full max-w-5xl px-6 pb-10 pt-4 text-sm text-muted-foreground">
        <div className="border-t border-border pt-6">
          <Link href="/for-organizations" className="underline underline-offset-4">
            Everyone we work with
          </Link>
          {(footerLinks ?? []).map((l) => (
            <span key={l.href}>
              {' · '}
              <Link href={l.href} className="underline underline-offset-4">
                {l.label}
              </Link>
            </span>
          ))}
          {' · '}
          <Link href="/" className="underline underline-offset-4">
            NextChapter for candidates
          </Link>
        </div>
      </footer>
    </div>
  )
}

/** A bounded content section: a serif heading, then its content. Three of these at most per page. */
export function AudienceSection({ id, title, children, className }: { id?: string; title: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={cn('mx-auto w-full max-w-4xl scroll-mt-6 px-6 pb-14', className)} aria-label={title}>
      <h2 className="font-display text-2xl font-semibold text-ink">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  )
}

/** "Show more": detail that opens on demand so it never competes with the page's one action. */
export function Disclosure({ id, title, children, defaultOpen = false }: { id?: string; title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details id={id} open={defaultOpen} className="group scroll-mt-6 rounded-2xl border border-border bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-base font-semibold text-ink marker:content-none">
        {title}
        <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden />
      </summary>
      <div className="border-t border-border px-5 py-5">{children}</div>
    </details>
  )
}

/** The closing band, and the only dark block on the page: where the action lands. */
export function ActionBand({ id, title, intro, children }: { id: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 bg-ink py-14 text-white" aria-label={title}>
      <div className="mx-auto max-w-2xl px-6">
        <h2 className="font-display text-2xl font-semibold">{title}</h2>
        {intro && <p className="mt-2 mb-6 text-white/80">{intro}</p>}
        <div className="mt-6 rounded-2xl border border-border bg-white p-6 text-ink sm:p-8">{children}</div>
      </div>
    </section>
  )
}
