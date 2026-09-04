import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { StructuredData } from '@/components/StructuredData'
import { SampleDossier } from '@/components/marketing/SampleDossier'

export const metadata = {
  title: 'The Executive Dossier — NextChapter',
  description: 'What the Executive Dossier contains, who sees it, and what you keep — the whole product in one page.',
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'The Executive Dossier — NextChapter',
}

// Partners Master Build Script §C3.3: "/dossier — the whole product in one
// page. Show a real Dossier. Explain what's verified and what isn't,
// plainly."
export default function DossierPage() {
  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={jsonLd} />
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-6">
          <Link href="/" className="shrink-0">
            <Logo className="text-2xl" />
          </Link>
          <nav className="flex items-center gap-1.5 text-sm">
            <Link href="/" className="font-medium text-brand hover:text-navy">
              NextChapter
            </Link>
            <ChevronRight className="size-4 text-muted-foreground" />
            <span className="font-medium text-foreground">The Executive Dossier</span>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 py-16 text-center">
        <p className="text-sm font-semibold tracking-wide text-brand uppercase">The Executive Dossier</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-navy sm:text-4xl">
          Your resume says what you did. This proves how you work.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          Five structured references. A skills and personality assessment for better job matches.
          One document you build once and keep forever — through this job search, and every one
          after it.
        </p>

        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button nativeButton={false} size="lg" variant="cta" render={<Link href="/onboarding/desire" />}>
            Start free
          </Button>
        </div>
      </main>

      <div className="border-t border-border bg-off-white py-16">
        <div className="mx-auto max-w-3xl px-6">
          <SampleDossier />
        </div>
      </div>

      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <p className="font-semibold text-navy">What it contains</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              A positioning statement, how you operate, your impact on the people who worked with you, your
              self-awareness (checked against what references actually said), your learning trajectory,
              where you do your best work, and proof-point narratives behind your biggest claims.
            </p>
          </div>
          <div>
            <p className="font-semibold text-navy">Who sees it</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              You control it. You choose when to share it with a recruiter or a hiring manager. It never
              includes your Market Reality Grade, detections, or anything from a coaching conversation —
              those stay with you and your coach, always.
            </p>
          </div>
          <div>
            <p className="font-semibold text-navy">You keep it</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              If you came to NextChapter through an employer&apos;s outplacement contract, the Dossier
              doesn&apos;t expire with that contract. It&apos;s yours — this search, and the next one.
            </p>
          </div>
          <div>
            <p className="font-semibold text-navy">What it isn&apos;t</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Not a personality quiz result and not a resume rewrite. It&apos;s evidence, collected and
              scored consistently from people who actually worked with you.
            </p>
          </div>
        </div>

        <div className="mt-12 rounded-xl border border-light-gray bg-off-white p-6 text-center">
          <p className="text-base leading-relaxed text-foreground">
            These are what five people said about working with you, collected and scored consistently.{' '}
            <span className="font-semibold">
              We don&apos;t independently verify their claims, and we don&apos;t pretend to.
            </span>
          </p>
        </div>

        <div className="mt-16 border-t border-border pt-6 text-center text-sm text-muted-foreground">
          <Link href="/how-it-works" className="underline underline-offset-4">
            See how it&apos;s built, step by step
          </Link>
          {' · '}
          <Link href="/recruiters" className="underline underline-offset-4">
            For recruiters
          </Link>
          {' · '}
          <Link href="/talent" className="underline underline-offset-4">
            For hiring teams
          </Link>
        </div>
      </main>
    </div>
  )
}
