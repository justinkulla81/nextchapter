import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'

const EXECUTION_ACTIVITIES = [
  'Sending outreach messages to your network',
  'Applying to roles that actually fit',
  'Closing specific skill gaps',
  'Collecting references and work samples',
  'Prepping for interviews before they happen',
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-border bg-white scroll-mt-20">
      <div className="mx-auto max-w-5xl px-6 py-20">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            You can&apos;t fix what you can&apos;t see. We turn a confusing, silent process into two
            numbers you can actually move.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          <div className="rounded-xl border border-light-gray bg-off-white p-6">
            <h3 className="font-semibold text-navy">Market Reality Grade — your baseline</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              We analyze your resume, experience, and how your industry is actually hiring right now
              to give you an honest starting grade — exactly where you stand today, before you change
              anything.
            </p>
          </div>
          <div className="rounded-xl border border-light-gray bg-off-white p-6">
            <h3 className="font-semibold text-navy">Search Execution Grade — your progress</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              This is the score you control. Every activity in your action plan raises it in real
              time — proof, in numbers, that you&apos;re doing the work.
            </p>
            <ul className="mt-3 space-y-1.5">
              {EXECUTION_ACTIVITIES.map((activity) => (
                <li key={activity} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-brand" />
                  {activity}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-4xl overflow-hidden rounded-xl border border-light-gray bg-white shadow-lg">
          <Image
            src="/marketing/success-dashboard.png"
            alt="NextChapter Success Dashboard showing a Market Reality Grade and a Search Execution Grade trending upward, with an action plan"
            width={2404}
            height={1762}
            className="w-full"
          />
        </div>

        <div className="mx-auto mt-10 max-w-3xl rounded-xl border border-light-gray bg-navy px-8 py-8 text-center text-white">
          <p className="text-lg leading-relaxed">
            That progress isn&apos;t just for you. When you apply, a hiring manager sees an Evidence
            Brief with your effort alongside your background. A recruiter calibrating a search sees
            your trajectory. If you work with a coach, they see your grade trend before every
            session. Together, that&apos;s what makes someone bet on you — not just a resume, but
            proof you&apos;re actively, effectively working the process.
          </p>
        </div>

        <div className="mt-12 text-center">
          <Button size="lg" variant="cta" render={<Link href="/onboarding/resume" />}>
            Get started
          </Button>
        </div>
      </div>
    </section>
  )
}
