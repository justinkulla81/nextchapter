import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, Check } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { Card, CardContent } from '@/components/ui/card'
import { CoachingWaitlistForm } from '@/components/coaching/CoachingWaitlistForm'
import { VictoriaChatPreview } from '@/components/coaching/VictoriaChatPreview'
import { CoachChatCard } from '@/components/dashboard/CoachChatCard'
import { StructuredData } from '@/components/StructuredData'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCoachConversation } from '@/lib/coach/get-conversation'

const SUGGESTED_QUESTIONS = [
  "What's actually dragging my grade down right now?",
  'How do I explain a layoff without sounding defensive?',
  'I got rejected today — help me not spiral.',
  'What should I focus on this week?',
  'Help me tighten my LinkedIn headline.',
]

export const metadata: Metadata = {
  title: 'Executive Coach — A Real Human Coach, When You Want One | NextChapter',
  description:
    'NextChapter gives everyone Victoria, our free AI coach. Executive Coach adds a real human career coach on top, for candidates who want it — waitlist open now.',
  alternates: { canonical: '/coaching' },
}

const INCLUDED = [
  'A dedicated human career coach, matched to your background and target role',
  'Regular 1:1 video sessions — not a chatbot, not a forum',
  'Live mock interviews with real-time feedback',
  'Direct review of your resume, LinkedIn, and outreach messages',
  'A second opinion on offers, negotiation, and hard calls Victoria can\'t make for you',
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'NextChapter Executive Coach',
  serviceType: 'Career coaching',
  provider: { '@type': 'Organization', name: 'NextChapter', url: 'https://launchyournextchapter.com' },
  areaServed: 'US',
  audience: { '@type': 'Audience', audienceType: 'Job seekers' },
  description:
    'A dedicated human career coach on top of Victoria, our free AI coach — mock interviews, resume review, and a second opinion on hard calls.',
  url: 'https://launchyournextchapter.com/coaching',
}

export default async function CoachingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isLoggedIn = !!user && !user.is_anonymous

  let knownContact: { email: string; firstName: string | null; lastName: string | null } | undefined
  let liveConversation: Awaited<ReturnType<typeof getOrCreateCoachConversation>> | null = null
  let canRequestMatch = false

  if (user?.email) {
    const profile = await prisma.candidateProfile.findUnique({
      where: { userId: user.id },
      select: { id: true, firstName: true, lastName: true, registrationCompletedAt: true, coachId: true },
    })
    knownContact = { email: user.email, firstName: profile?.firstName ?? null, lastName: profile?.lastName ?? null }
    canRequestMatch = !!(!user.is_anonymous && profile?.registrationCompletedAt && !profile.coachId)

    // Only a fully registered candidate has a durable conversation worth
    // showing here — a still-anonymous or mid-onboarding session has no
    // profile Victoria can actually ground her replies in, so those visitors
    // get the static preview instead (below).
    if (!user.is_anonymous && profile?.registrationCompletedAt) {
      liveConversation = await getOrCreateCoachConversation(profile.id, profile.firstName)
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={jsonLd} />
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-6">
          <Link href={isLoggedIn ? '/dashboard' : '/'} className="shrink-0">
            <Logo className="text-2xl" />
          </Link>
          <nav className="flex min-w-0 items-center gap-4 text-sm">
            {!isLoggedIn && (
              <Link href="/" className="shrink-0 text-muted-foreground hover:text-foreground">
                Home
              </Link>
            )}
            <Link href="/dashboard" className="shrink-0 font-medium text-brand hover:text-navy">
              Dashboard
            </Link>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate font-medium text-foreground">
              Executive Coach
            </span>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
          <div>
            <p className="text-sm font-semibold tracking-wide text-brand uppercase">
              Meet Victoria
            </p>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-navy sm:text-3xl">
              Your free AI coach — chat with her right now
            </h1>
            <p className="mt-3 text-base text-muted-foreground">
              Victoria is included free for every candidate. Tell her how the search is going and
              she&apos;ll help you figure out what to actually do next — talk through a rejection,
              get a straight answer on where your grade stands, or just check in when the job
              hunt is grinding you down.
            </p>

            <div className="mt-6">
              {liveConversation ? (
                <CoachChatCard initialMessages={liveConversation.messages} suggestedQuestions={SUGGESTED_QUESTIONS} />
              ) : (
                <>
                  <VictoriaChatPreview />
                  <div className="mt-4 space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Ask her things like</p>
                    <ul className="flex flex-wrap gap-1.5">
                      {SUGGESTED_QUESTIONS.map((question) => (
                        <li
                          key={question}
                          className="rounded-full border border-border bg-white px-3 py-1 text-xs text-foreground"
                        >
                          {question}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="space-y-8">
            {canRequestMatch && (
              <Card className="h-fit border-brand/20 bg-off-white">
                <CardContent className="space-y-3 pt-6">
                  <div>
                    <h3 className="font-semibold text-foreground">Get matched with a coach</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Answer a couple of quick preference questions and see coaches suggested for your
                      background.
                    </p>
                  </div>
                  <Link
                    href="/dashboard/coaching-match"
                    className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:text-navy"
                  >
                    Find my coach <ChevronRight className="size-4" />
                  </Link>
                </CardContent>
              </Card>
            )}
            <Card className="h-fit border-brand/20 bg-off-white">
              <CardContent className="space-y-4 pt-6">
                <div>
                  <h3 className="font-semibold text-foreground">Join the Executive Coach waitlist</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    A real human coach on top of Victoria. We&apos;ll email you when a spot opens up.
                  </p>
                </div>
                <CoachingWaitlistForm source="coaching_page" knownContact={knownContact} />
                <div className="space-y-2 border-t border-border pt-3">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Optional add-ons, opt-in only
                  </p>
                  <p className="text-sm text-foreground">Public Presence & Visibility Coaching</p>
                  <p className="text-xs text-muted-foreground">
                    We look at your existing public footprint — press, podcasts, talks — and your coach helps
                    you decide how visible to be in your search. You&apos;ll always be asked directly before
                    anything is looked at.
                  </p>
                  <p className="mt-2 text-sm text-foreground">Background Check (via Checkr)</p>
                  <p className="text-xs text-muted-foreground">
                    For candidates who want a pre-verified profile ready to show recruiters. Requires a
                    separate written disclosure and authorization before anything runs — coming soon.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div>
              <p className="text-sm font-semibold tracking-wide text-brand uppercase">
                Executive Coach
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Victoria isn&apos;t going anywhere. Executive Coach is a separate, paid option for
                people who want a real human career coach too — someone who&apos;s done real
                hiring and can give you a second opinion Victoria isn&apos;t built to give.
              </p>

              <ul className="mt-4 space-y-2">
                {INCLUDED.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" />
                    <span className="text-sm text-foreground">{item}</span>
                  </li>
                ))}
              </ul>

              <p className="mt-4 text-xs text-muted-foreground">
                Cancel anytime. Pricing shared when spots open up.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
