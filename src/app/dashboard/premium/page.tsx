import type { Metadata } from 'next'
import { GraduationCap, Building2, LineChart, Check } from 'lucide-react'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CoachingWaitlistForm } from '@/components/coaching/CoachingWaitlistForm'
import { captureServerEvent } from '@/lib/posthog/server'
import { earlyCareerAudience, featureVisible } from '@/lib/early-career/audience'

export const metadata: Metadata = { title: 'Premium' }

const COACH_INCLUDED = [
  'A dedicated human career coach, matched to your background and target role',
  'Regular 1:1 video sessions — not a chatbot, not a forum',
  'Live mock interviews with real-time feedback',
  'Direct review of your resume, LinkedIn, and outreach messages',
  "A second opinion on offers, negotiation, and hard calls Victoria can't make for you",
]

const RECRUITER_INCLUDED = [
  'A warm, personal introduction to executive search firms and in-house recruiters actively hiring for roles like yours',
  "Priority placement in front of the recruiters already searching NextChapter's candidate database",
  'Your Executive Dossier hand-delivered to a curated shortlist, not just passively listed',
  "A recruiter's read on how your background is landing — what's working, what's raising questions",
]

const MARKET_INTEL_INCLUDED = [
  'Real posted comp bands for your target function, computed from our own job data — not a resold data license',
  'A target list of companies filtered by hiring trajectory, size, ownership, and geography',
  'Decision-maker mapping and warm-path contacts at the companies you actually want to work for',
  'A generated weekly brief on openings, comp movement, and warm paths at your target companies',
]

export default async function PremiumPage() {
  const [profile, {
    data: { user },
  }] = await Promise.all([getDashboardProfile(), createClient().then((supabase) => supabase.auth.getUser())])

  const knownContact = user?.email
    ? { email: user.email, firstName: profile.firstName, lastName: profile.lastName }
    : undefined

  // Early-career members see the same offer without the executive framing.
  const audience = earlyCareerAudience(profile)
  const exec = featureVisible('executive_upsells', audience)
  const coachLabel = exec ? 'Executive Coach' : 'Career coach'
  const recruiterLabel = exec ? 'Executive Recruiter' : 'Recruiter introductions'
  const recruiterIncluded = exec
    ? RECRUITER_INCLUDED
    : [
        'A warm, personal introduction to in-house recruiters and agencies hiring for roles like yours',
        "Priority placement in front of the recruiters already searching NextChapter's candidate database",
        "A recruiter's read on how your background is landing — what's working, what's raising questions",
      ]

  captureServerEvent(profile.id, 'premium_bundle_page_viewed', { audience })

  return (
    <div className="max-w-3xl space-y-8 pb-12">
      <div>
        <p className="text-sm font-semibold tracking-wide text-orange uppercase">NextChapter Premium</p>
        <h1 className="mt-1 font-heading text-2xl font-semibold text-foreground">
          A human coach, recruiter introductions, and full market intelligence — together
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Premium bundles our three most-requested add-ons — {coachLabel}, {recruiterLabel}, and Market
          Intelligence — into a single account tier. It&apos;s not live yet; join the waitlist below and
          we&apos;ll reach out as spots open up.
        </p>
      </div>

      <p className="text-sm text-muted-foreground">
        Joining the waitlist doesn&apos;t commit you to anything.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="size-4 text-orange" aria-hidden="true" />
            {coachLabel}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {COACH_INCLUDED.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-orange" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="size-4 text-orange" aria-hidden="true" />
            {recruiterLabel}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {recruiterIncluded.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-orange" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LineChart className="size-4 text-orange" aria-hidden="true" />
            Market Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {MARKET_INTEL_INCLUDED.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-orange" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Join the Premium waitlist</CardTitle>
        </CardHeader>
        <CardContent>
          <CoachingWaitlistForm source="premium_bundle_dashboard" knownContact={knownContact} />
        </CardContent>
      </Card>
    </div>
  )
}
