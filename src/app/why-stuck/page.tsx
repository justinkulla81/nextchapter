import type { Metadata } from 'next'
import Image from 'next/image'
import { X } from 'lucide-react'
import { ByTheNumbers } from '@/components/home/ByTheNumbers'
import { SituationalButtons } from '@/components/home/SituationalButtons'
import { SearchQuestionForm } from '@/components/marketing/SearchQuestionForm'
import { NewsletterSignup } from '@/components/marketing/NewsletterSignup'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { PublicSiteHeader } from '@/components/marketing/PublicSiteChrome'

export const metadata: Metadata = {
  title: "Why You're Stuck",
  description:
    "You're not imagining it. Job searching is genuinely hard right now, and most of it happens before a human ever sees your name.",
  alternates: { canonical: '/why-stuck' },
}

const painPoints = [
  "Applications vanish into a void — you never learn why.",
  "You know you should be networking — but it's hard and demoralizing.",
  'LinkedIn doesn\'t work, and "Open to Work" reads as a stigma.',
  "A gap on your resume is held against you unfairly — and there's nothing you could do about it. Until now, with NextChapter.",
  "The loneliness is real — it's natural to have days, even weeks, of feeling disorganized and demotivated.",
  "The financial pressure doesn't wait, even when the process does.",
]

export default function WhyStuckPage() {
  return (
    <div className="flex flex-1 flex-col">
      <PublicSiteHeader />

      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-navy sm:text-5xl">
            Why you&apos;re stuck
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            You&apos;re not imagining it. Unemployment is unpleasant and the search process is
            genuinely hard.
          </p>
          <div className="mt-8">
            <TrackedLink
              href="#ask"
              event="why_stuck_ask_clicked"
              properties={{ placement: 'hero' }}
              className="inline-flex items-center justify-center rounded-lg bg-success px-5 py-3 text-sm font-semibold text-white hover:bg-success-hover"
            >
              Ask us about your search
            </TrackedLink>
          </div>
        </div>
      </section>

      <section className="bg-off-white px-6 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-xl font-semibold text-navy">You&apos;re not the only one who feels this way</h2>
          <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
            Business Insider talked to laid-off tech workers about what the experience actually
            felt like — and what they learned moving into their next chapter.
          </p>
          <div className="mx-auto mt-6 aspect-video overflow-hidden rounded-xl border border-light-gray shadow-lg">
            <iframe
              src="https://www.youtube-nocookie.com/embed/3I-xv56cBUY"
              className="h-full w-full"
              title="Life Lessons From Big Tech Workers Who Got Laid Off — Business Insider"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      </section>

      <section className="bg-white px-6 py-16">
        <ul className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {painPoints.map((point) => (
            <li
              key={point}
              className="flex items-start gap-3 rounded-xl border border-light-gray bg-white px-4 py-4"
            >
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-orange/10">
                <X className="size-3.5 text-orange" />
              </span>
              <span className="text-sm leading-snug text-foreground">{point}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-off-white px-6 py-16">
        <ByTheNumbers />
      </section>

      <section className="bg-white px-6 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-xl font-semibold text-navy">
            The worst part isn&apos;t the rejection. It&apos;s never finding out why.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            Most rejections read exactly like this — and give you nothing to actually learn from:
          </p>
          <div className="mt-8 flex justify-center">
            <Image
              src="/marketing/rejection-email-example.png"
              alt="A generic rejection email: 'Thank you for your interest in the [Role] position. After careful consideration, we have decided to move forward with other candidates who more closely match our needs at this time.'"
              width={640}
              height={520}
              className="w-full max-w-xl rounded-xl border border-light-gray shadow-sm"
            />
          </div>
        </div>
      </section>

      <section className="bg-off-white px-6 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-xl font-semibold text-navy">Hear it from Chris</h2>
          <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
            A NextChapter member on what being stuck actually felt like — and what changed.
          </p>
          <div className="mx-auto mt-6 overflow-hidden rounded-xl border border-light-gray bg-white shadow-lg">
            <video
              controls
              preload="metadata"
              className="w-full"
              src="https://uvoulytrsrxasqzutlmq.supabase.co/storage/v1/object/public/site-media/chris-story.mp4"
            >
              Your browser doesn&apos;t support embedded video.
            </video>
          </div>
        </div>
      </section>

      <section className="bg-white px-6 py-16">
        <SituationalButtons />
      </section>

      <section id="ask" className="scroll-mt-6 bg-off-white px-6 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-navy">Tell us what you&apos;re running into</h2>
          <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
            A question, a worry, the thing that keeps not working. No account needed.
          </p>
          <div className="mt-8 rounded-xl border border-light-gray bg-white p-6 shadow-sm">
            <SearchQuestionForm />
          </div>
        </div>
      </section>

      <section className="bg-white px-6 py-16">
        <NewsletterSignup source="why-stuck" />
      </section>
    </div>
  )
}
