import type { ReactNode } from 'react'
import { WaitlistForm } from '@/components/audience/WaitlistForm'
import type { AudienceTab } from '@/components/audience/audience-data'
import { ActionBand, AudienceSection, AudienceShell, Disclosure } from '@/components/organizations/AudienceShell'

// Partners Master Build Script §C3.2 asks for one structure on every landing page: headline,
// subhead, the beats, one concrete artifact, objection handling, CTA. The redesign
// (docs/candidate-redesign.md) keeps all of it and orders it by how much a visitor needs:
// the headline and one action first, then what you get, then the proof and the evidence
// folded under "Show more", then the form. `artifact` is the page-specific real sample.
//
// With a direct signup (hiring teams, coaches) the primary action is that signup; without
// one it takes the visitor to the waitlist form at the bottom of the page.

const VISIBLE_POINTS = 4

export function OrganizationPageTemplate({
  tab,
  artifact,
  parent,
  footerLinks,
}: {
  tab: AudienceTab
  artifact?: ReactNode
  parent?: { href: string; label: string }
  footerLinks?: { href: string; label: string }[]
}) {
  const loginHref = tab.loginHref ?? tab.directSignupHref?.replace('/signup', '/login')
  const primary = tab.directSignupHref
    ? { label: tab.directSignupLabel ?? 'Get started free', href: tab.directSignupHref }
    : { label: tab.formHeading, href: '#join' }

  const shown = tab.points.slice(0, VISIBLE_POINTS)
  const more = tab.points.slice(VISIBLE_POINTS)

  const extraLinks = [
    ...(tab.id === 'coaches' ? [{ href: '/coach-platform', label: 'Your own branded platform' }] : []),
    ...(tab.id === 'government' ? [{ href: '/reports/latest', label: 'White Collar Employment Report and WIOA data' }] : []),
    ...(['outplacement', 'government', 'nonprofits'].includes(tab.id) ? [{ href: '/ai-training', label: 'AI training we build for your people' }] : []),
    ...(footerLinks ?? []),
  ]

  return (
    <AudienceShell
      page={tab.id}
      parent={parent}
      eyebrow={tab.eyebrow}
      headline={tab.headline}
      subhead={tab.subhead}
      primary={primary}
      primaryNote={tab.directSignupHref ? 'Or join the waitlist at the bottom of the page for updates instead.' : undefined}
      loginHref={loginHref}
      footerLinks={extraLinks}
    >
      <AudienceSection title="What you get">
        <ul className="space-y-4">
          {shown.map((point) => (
            <li key={point.lead} className="flex items-start gap-3">
              <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-ink" />
              <span className="text-base leading-relaxed">
                <span className="font-semibold">{point.lead}</span> {point.body}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-6 rounded-2xl border border-border bg-muted/40 p-4 text-sm leading-relaxed text-muted-foreground">
          <span className="font-semibold text-ink">{tab.contrastLabel}</span> {tab.contrastBody}
        </p>
      </AudienceSection>

      {(artifact || tab.insightSection || more.length > 0) && (
        <AudienceSection title="Show more" className="space-y-3">
          {artifact && (
            <Disclosure title="See it, don’t just take our word for it">
              <div className="overflow-x-auto">{artifact}</div>
            </Disclosure>
          )}
          {tab.insightSection && (
            <Disclosure title={tab.insightSection.heading}>
              <ul className="grid gap-5 sm:grid-cols-2">
                {tab.insightSection.items.map((item) => (
                  <li key={item.lead}>
                    <p className="font-semibold">{item.lead}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                  </li>
                ))}
              </ul>
            </Disclosure>
          )}
          {more.length > 0 && (
            <Disclosure title={`${more.length} more thing${more.length === 1 ? '' : 's'} you get`}>
              <ul className="space-y-4">
                {more.map((point) => (
                  <li key={point.lead} className="text-base leading-relaxed">
                    <span className="font-semibold">{point.lead}</span> {point.body}
                  </li>
                ))}
              </ul>
            </Disclosure>
          )}
        </AudienceSection>
      )}

      <ActionBand id="join" title={tab.directSignupHref ? 'Not ready yet? Stay in touch.' : 'Tell us about you'}>
        <WaitlistForm tab={tab} />
      </ActionBand>
    </AudienceShell>
  )
}
