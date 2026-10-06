import type { Metadata } from 'next'
import { ReferralForm } from '@/components/marketing/ReferralForm'
import { ReferralShareBox } from '@/components/marketing/ReferralShareBox'
import { PublicSiteHeader } from '@/components/marketing/PublicSiteChrome'

export const metadata: Metadata = {
  title: 'Refer Someone',
  description: 'Someone you care about is going through a career transition. Give them a head start.',
  alternates: { canonical: '/refer' },
}

export default function ReferPage() {
  return (
    <div className="flex flex-1 flex-col">
      <PublicSiteHeader />

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
