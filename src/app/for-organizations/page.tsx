import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { AiJobsStat } from '@/components/marketing/AiJobsStat'
import { ContactForm } from '@/components/marketing/ContactForm'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { ActionBand, AudienceSection, AudienceShell } from '@/components/organizations/AudienceShell'
import { StructuredData } from '@/components/StructuredData'
import { HUB_COPY, HUB_PATH, HUB_SEO } from '@/lib/marketing/portal-pages/hub'
import { PORTAL_LIST } from '@/lib/marketing/portals'
import { hubJsonLd, portalMetadata } from '@/lib/marketing/portal-seo'

// The AI-jobs stat block reads the daily snapshot; refresh the page hourly.
export const revalidate = 3600

export const metadata: Metadata = portalMetadata(HUB_SEO)

export default function ForOrganizationsPage() {
  return (
    <>
      <StructuredData
        data={hubJsonLd({
          path: HUB_PATH,
          name: HUB_SEO.title,
          description: HUB_COPY.jsonLdDescription,
          items: PORTAL_LIST.map((p) => ({ name: p.name, path: p.route })),
          trail: HUB_COPY.trail,
        })}
      />
      <AudienceShell
        page="for_organizations"
        parent={{ href: '/', label: 'NextChapter' }}
        eyebrow={HUB_COPY.eyebrow}
        headline={HUB_COPY.headline}
        subhead={HUB_COPY.subhead}
        primary={HUB_COPY.primary}
        primaryNote={HUB_COPY.primaryNote}
        footerLinks={HUB_COPY.extraLinks}
      >
        <AudienceSection id="portals" title={HUB_COPY.portalsHeading}>
          <p className="mb-6 max-w-2xl text-base leading-relaxed text-muted-foreground">{HUB_COPY.portalsIntro}</p>
          <ul className="grid gap-4 md:grid-cols-2">
            {PORTAL_LIST.map((p) => (
              <li key={p.key} className="flex flex-col rounded-2xl border border-border bg-white p-5">
                <h3 className="text-lg font-semibold text-ink">{p.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{p.who}</p>
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink">
                  {p.gets.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
                <p className="mt-3 text-sm text-muted-foreground">
                  <span className="font-semibold text-ink">How you start:</span> {p.start}
                </p>
                <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-2 pt-4">
                  <TrackedLink
                    href={p.route}
                    event="portal_hub_card_clicked"
                    properties={{ page: 'for_organizations', portal: p.key, cta: 'see_page' }}
                    className="inline-flex h-11 items-center rounded-full border border-ink px-6 text-sm font-semibold text-ink hover:bg-muted"
                  >
                    See {p.name}
                  </TrackedLink>
                  <TrackedLink
                    href={p.loginHref}
                    event="portal_hub_card_clicked"
                    properties={{ page: 'for_organizations', portal: p.key, cta: 'log_in' }}
                    className="text-sm font-semibold text-brand underline underline-offset-4"
                  >
                    {p.loginLabel}
                  </TrackedLink>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-muted-foreground">
            Nonprofits and community organizations can also claim a page. See{' '}
            <Link href="/nonprofits" className="font-semibold text-brand underline underline-offset-4">
              nonprofits and community organizations
            </Link>
            .
          </p>
        </AudienceSection>

        <Suspense fallback={null}>
          <AiJobsStat variant="b2b" />
        </Suspense>

        <ActionBand id="contact" title={HUB_COPY.contactTitle} intro={HUB_COPY.contactIntro}>
          <h3 className="mb-3 text-base font-semibold text-ink">{HUB_COPY.contactForm.heading}</h3>
          <ContactForm initialAudience={HUB_COPY.contactForm.audience} source={HUB_COPY.contactForm.source} />
          <p className="mt-4 text-sm text-muted-foreground">
            Read the{' '}
            <Link href="/reports/latest" className="underline underline-offset-4">
              White Collar Employment Report
            </Link>
            .
          </p>
        </ActionBand>
      </AudienceShell>
    </>
  )
}
