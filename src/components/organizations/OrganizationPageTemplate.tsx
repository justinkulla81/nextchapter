import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { Card, CardContent } from '@/components/ui/card'
import { WaitlistForm } from '@/components/audience/WaitlistForm'
import type { AudienceTab } from '@/components/audience/audience-data'

export function OrganizationPageTemplate({ tab }: { tab: AudienceTab }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-6">
          <Link href="/" className="shrink-0">
            <Logo className="text-2xl" />
          </Link>
          <Link
            href="/"
            className="order-2 shrink-0 text-sm text-muted-foreground hover:text-foreground sm:order-3"
          >
            For candidates
          </Link>
          <nav className="order-3 flex min-w-0 basis-full items-center gap-1.5 text-sm sm:order-2 sm:basis-auto">
            <Link
              href="/for-organizations"
              className="shrink-0 font-medium text-brand hover:text-navy"
            >
              For Organizations
            </Link>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate font-medium text-foreground sm:flex-none">
              {tab.eyebrow}
            </span>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 py-16">
        {/* Headline/subhead paired with the CTA form side-by-side, so the form
            (and its submit button) is visible without scrolling, not just the
            supporting long-form content further down the page. */}
        <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
          <div>
            <p className="text-sm font-semibold tracking-wide text-brand uppercase">
              {tab.eyebrow}
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-navy sm:text-4xl">
              {tab.headline}
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">{tab.subhead}</p>
          </div>

          <Card className="h-fit border-brand/20 bg-off-white">
            <CardContent className="space-y-4 pt-6">
              {tab.directSignupHref && (
                <div className="space-y-3 border-b border-border pb-4">
                  <Link
                    href={tab.directSignupHref}
                    className="flex w-full items-center justify-center rounded-md bg-brand px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand/90"
                  >
                    {tab.directSignupLabel ?? 'Get started free'}
                  </Link>
                  <p className="text-center text-xs text-muted-foreground">
                    Or join the waitlist below for updates instead.
                  </p>
                </div>
              )}
              <WaitlistForm tab={tab} />
            </CardContent>
          </Card>
        </div>

        {tab.insightSection && (
          <div className="mt-12 rounded-xl border border-border bg-off-white p-6">
            <p className="text-sm font-semibold tracking-wide text-navy uppercase">
              {tab.insightSection.heading}
            </p>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2">
              {tab.insightSection.items.map((item) => (
                <li key={item.lead}>
                  <p className="font-semibold text-foreground">{item.lead}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-12 max-w-2xl">
          <ul className="space-y-4">
            {tab.points.map((point) => (
              <li key={point.lead} className="flex items-start gap-3">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-success" />
                <span className="text-base leading-relaxed text-foreground">
                  <span className="font-semibold">{point.lead}</span> {point.body}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-8 rounded-lg border border-light-gray bg-off-white p-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">{tab.contrastLabel}</span>{' '}
              {tab.contrastBody}
            </p>
          </div>
        </div>

        <div className="mt-16 border-t border-border pt-6 text-sm text-muted-foreground">
          <Link href="/for-organizations" className="underline underline-offset-4">
            ← All organization types
          </Link>
          {' · '}
          <Link href="/" className="underline underline-offset-4">
            NextChapter for candidates
          </Link>
        </div>
      </main>
    </div>
  )
}
