import type { Metadata } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { ReferralForm } from '@/components/marketing/ReferralForm'
import { ReferralShareBox } from '@/components/marketing/ReferralShareBox'

export const metadata: Metadata = {
  title: 'Refer Someone — NextChapter',
  description: 'Someone you care about is going through a career transition. Give them a head start.',
  alternates: { canonical: '/refer' },
}

export default function ReferPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
          <Link href="/">
            <Logo className="text-2xl" />
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/" className="text-muted-foreground hover:text-foreground">
              Home
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-navy sm:text-4xl">
          Someone you care about is going through this.
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Give them a head start. NextChapter is free for candidates — always. Send them a direct
          link and let them start whenever they&apos;re ready.
        </p>
        <div className="mt-8">
          <ReferralForm />
        </div>
        <div className="mt-6 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          <span>or share it yourself</span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <div className="mt-6">
          <ReferralShareBox />
        </div>
      </div>
    </div>
  )
}
