import type { Metadata } from 'next'
import { WorkforceDemoForm } from '@/components/demo/WorkforceDemoForm'

export const metadata: Metadata = {
  title: 'See NextChapter for your region',
  description: 'Workforce boards, economic development organizations and chambers: build a working demo for your own region in under a minute.',
  robots: { index: false, follow: true },
}

export default function WorkforceDemoPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-8 px-4 py-12">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">See NextChapter for your region</h1>
        <p className="text-muted-foreground">
          For workforce boards, economic development organizations and chambers. Tell us your city and we build a working demo: your region&apos;s real WARN notices,
          unemployment and workforce board, with sample member companies and job seekers, so you can see how many people you&apos;d keep working locally.
        </p>
        <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
          <li>Give a member company&apos;s laid-off people free seats, with a sign-up page to share.</li>
          <li>Local jobs rank first for every job seeker you serve.</li>
          <li>See how many landed and how many stayed in your region.</li>
        </ul>
      </div>
      <WorkforceDemoForm />
      <p className="text-xs text-muted-foreground">The demo is read-only and lasts 30 days. Sample people and companies are fictional; regional figures are public data with their sources.</p>
    </main>
  )
}
