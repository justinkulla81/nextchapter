import type { Metadata } from 'next'
import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = { title: 'Support During Transition' }


export default async function SupportDuringTransitionPage() {
  const profile = await getDashboardData()

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Support During Transition</h1>
        <p className="mt-1 text-muted-foreground">
          Losing a job — or leaving one, or just not knowing what&apos;s next — is genuinely
          stressful. This page is private, optional, and never affects your grade. Nothing here is
          triggered by your activity on the platform; you&apos;re the only one who decides to come
          here.
        </p>
        <PageHeaderBoxes pageKey="support" candidateId={profile.id} />
      </div>

      <Card className="border-destructive/30 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-base">If you&apos;re in crisis right now</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-foreground">
          <p>
            Call or text <span className="font-semibold">988</span> (the Suicide &amp; Crisis
            Lifeline, US) — free, confidential, available 24/7, and not just for suicidal crisis.
            It&apos;s for any moment that feels like too much.
          </p>
          <p>
            <a
              href="https://988lifeline.org/chat"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-4"
            >
              Or chat online at 988lifeline.org →
            </a>
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Talk to a licensed professional</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              A career transition is a real, recognized stressor — you don&apos;t need to be in
              crisis to benefit from talking to someone. If your former employer offers an
              Employee Assistance Program (EAP), it often stays active for a window after you
              leave — worth checking.
            </p>
            <a
              href="https://www.psychologytoday.com/us/therapists"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-primary underline underline-offset-4"
            >
              Find a therapist (Psychology Today directory) →
            </a>
            <a
              href="https://openpathcollective.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-primary underline underline-offset-4"
            >
              Open Path Collective — reduced-fee therapy →
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Talk to your Coach</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Every member has access to human support. If you want dedicated, one-on-one
              conversation about what you&apos;re going through — not just the search itself — a
              Premium Executive Coach session is built for that too.
            </p>
            <Link href="/coaching" className="block text-primary underline underline-offset-4">
              Learn about Executive Coaching →
            </Link>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        This page is general information, not a substitute for professional medical or mental
        health care. It is not a marketplace and NextChapter does not charge for anything on this
        page.
      </p>
    </div>
  )
}
