import type { Metadata } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { AfterLayoffForm } from '@/components/marketing/AfterLayoffForm'
import { canonical } from '@/lib/seo/canonical'

// The page the owner sends to people who were just let go. One headline, one email field; the link's ?utm_source=<who>
// is saved on the lead (source "after-a-layoff:<who>"). Kept out of the index: it is reached by link, not by search.
export const metadata: Metadata = {
  title: 'Just got fired? Let us help | NextChapter',
  description: 'Leave your email and get a first-week plan that starts with the deadlines that cost people money. Free.',
  ...canonical('/after-a-layoff'),
  robots: { index: false, follow: true },
}

export default function AfterALayoffPage() {
  return (
    <div className="theme-redesign flex flex-1 flex-col bg-white text-ink">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center px-6 py-5">
          <Link href="/" aria-label="NextChapter home">
            <Logo className="text-2xl" />
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-6 pt-14 pb-16 text-center">
        <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">Just got fired? Let us help.</h1>
        <p className="mx-auto mt-5 mb-8 max-w-2xl text-lg text-muted-foreground">
          Get a first-week plan by email. It starts with the deadlines that cost people money: filing for unemployment, severance and health coverage. Free, and no résumé needed.
        </p>
        <AfterLayoffForm />
      </main>
    </div>
  )
}
