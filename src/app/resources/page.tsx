import Link from 'next/link'
import type { Metadata } from 'next'
import { Logo } from '@/components/Logo'
import { Card, CardContent } from '@/components/ui/card'
import { GUIDE_LANDING_CONTENT } from '@/lib/constants/guide-landing-content'

export const metadata: Metadata = {
  title: 'Resources',
  description: 'Free guides for every stage of a job search — from your first 72 hours to your first 90 days in a new role.',
  alternates: { canonical: '/resources' },
}

export default function ResourcesIndexPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
          <Link href="/" className="shrink-0">
            <Logo className="text-2xl" />
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight text-navy">Resources</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Guides for every stage of a job search — from your first 72 hours to your first 90 days in
          a new role.
        </p>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GUIDE_LANDING_CONTENT.map((content) => (
            <Link key={content.slug} href={`/resources/${content.slug}`} className="block">
              <Card className="h-full transition-colors hover:border-brand">
                <CardContent className="pt-6">
                  <h2 className="font-semibold">{content.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {content.metaDescription}
                  </p>
                  <span className="mt-4 inline-block text-sm font-medium text-brand">Read more →</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="mt-16 border-t border-border pt-6 text-sm text-muted-foreground">
          <Link href="/" className="underline underline-offset-4">
            ← NextChapter home
          </Link>
        </div>
      </main>
    </div>
  )
}
