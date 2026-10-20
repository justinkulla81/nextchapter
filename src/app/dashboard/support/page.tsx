import type { Metadata } from 'next'
import Link from 'next/link'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { isRedesignOn } from '@/lib/redesign/flag'
import { PageHeader } from '@/components/candidate/PageHeader'
import { ActionLink } from '@/components/candidate/ActionLink'
import { Section } from '@/components/candidate/ui'

export const metadata: Metadata = { title: 'Support During Transition' }


export default async function SupportDuringTransitionPage() {
  const profile = await getDashboardProfile()

  if (isRedesignOn(profile.email)) {
    // Talk to someone in the redesign: the free, any-hour line first, then the people who can help with the weight of a search.
    return (
      <div className="space-y-8">
        <PageHeader
          title="Talk to someone"
          intro="A hard week is normal. You do not have to carry it alone. This page is private and optional, and nothing here is shared or scored."
          action={<ActionLink variant="primary" href="tel:988" event="support_crisis_line_clicked" props={{ channel: 'call', source: 'support_header' }}>Call or text 988</ActionLink>}
        />
        <section aria-labelledby="crisis" className="space-y-3 rounded-2xl border border-border p-6 sm:p-7">
          <h2 id="crisis" className="font-display text-2xl font-semibold text-ink">If it feels like too much right now</h2>
          <p className="max-w-xl text-base text-ink">
            Call or text <span className="font-semibold">988</span>, the Suicide and Crisis Lifeline in the US. It is free, confidential and open 24 hours a day, and it is for any moment that feels like too much, not only a crisis.
          </p>
          <ActionLink href="https://988lifeline.org/chat" variant="text" external event="support_crisis_line_clicked" props={{ channel: 'chat', source: 'support_card' }}>Or chat online at 988lifeline.org</ActionLink>
        </section>
        <Section id="people" title="People who can help with the weight of a search">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3 rounded-2xl border border-border p-5">
              <h3 className="text-base font-semibold text-ink">A licensed professional</h3>
              <p className="text-sm text-ink">A career transition is a real stressor, and you do not need to be in crisis to talk to someone. If your former employer had an employee assistance program, it often stays open for a while after you leave.</p>
              <div className="space-y-1.5">
                <ActionLink href="https://www.psychologytoday.com/us/therapists" variant="text" external event="support_resource_opened" props={{ resource: 'psychology_today' }}>Find a therapist</ActionLink>
                <br />
                <ActionLink href="https://openpathcollective.org/" variant="text" external event="support_resource_opened" props={{ resource: 'open_path' }}>Open Path Collective, reduced-fee therapy</ActionLink>
              </div>
            </div>
            <div className="space-y-3 rounded-2xl border border-border p-5">
              <h3 className="text-base font-semibold text-ink">Your coach</h3>
              <p className="text-sm text-ink">Every member has access to human support. For one-on-one time about what you are going through, not only the search, an executive coach session is built for that too.</p>
              <ActionLink href="/coaching" variant="text" event="support_resource_opened" props={{ resource: 'coaching' }}>Learn about executive coaching</ActionLink>
            </div>
          </div>
        </Section>
        <p className="text-sm text-muted-foreground">General information, not a substitute for medical or mental health care. NextChapter does not charge for anything on this page.</p>
      </div>
    )
  }

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
