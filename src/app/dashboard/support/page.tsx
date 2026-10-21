import type { Metadata } from 'next'
import { PageHeader } from '@/components/candidate/PageHeader'
import { ActionLink } from '@/components/candidate/ActionLink'
import { Section } from '@/components/candidate/ui'

export const metadata: Metadata = { title: 'Support During Transition' }

export default async function SupportDuringTransitionPage() {
  // The free, any-hour line first, then the people who can help with the weight of a search.
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
