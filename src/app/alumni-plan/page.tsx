import { pageMetadata } from '@/lib/seo/keywords'
import { AudienceSection, AudienceShell, Disclosure } from '@/components/organizations/AudienceShell'
import { StructuredData } from '@/components/StructuredData'

export const metadata = pageMetadata('/alumni-plan')

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Higher Education & Alumni plan — NextChapter',
}

const BEATS = [
  { lead: 'Your Dossier stays alive.', body: 'Not archived, not frozen — an annual refresh keeps it current.' },
  { lead: 'A quarterly market check with comp benchmarking.', body: 'So you know where you stand even when you\'re not looking.' },
  { lead: 'Benefits from institutions our alumni bring in.', body: 'The Higher Education Benefits Network — real programs, sourced by people who work there.' },
  { lead: 'Board and advisory listings.', body: 'Visibility into opportunities most searches never surface.' },
  { lead: 'Break-glass reactivation, in a day.', body: 'If it happens again, you\'re not starting from zero.' },
]

// Partners Master Build Script §C2.6/§C4.6 — membership "opens at placement,
// not before... the only moment it converts." Phase 8 already built the
// real signup/subscription flow at /dashboard/membership; this page is
// informational and links there rather than building a second, parallel
// form.
export default function MembershipPage() {
  return (
    <>
      <StructuredData data={jsonLd} />
      <AudienceShell
        page="membership"
        parent={{ href: '/', label: 'NextChapter' }}
        eyebrow="Higher Education and the Alumni plan"
        headline="Never start from zero again."
        subhead="You just did the hardest professional thing there is. Keep the evidence current so the next time takes weeks, not months."
        primary={{ label: 'Join', href: '/dashboard/membership' }}
        primaryNote="Your NextChapter Member account stays free. The Alumni plan adds the extras below."
        footerLinks={[
          { href: '/pricing', label: 'Plans' },
          { href: '/dossier', label: 'About the Dossier' },
        ]}
      >
        <AudienceSection title="What you get">
          <div className="grid gap-6 sm:grid-cols-2">
            {BEATS.map((beat) => (
              <div key={beat.lead}>
                <p className="font-semibold">{beat.lead}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{beat.body}</p>
              </div>
            ))}
          </div>
        </AudienceSection>

        <AudienceSection title="Show more" className="space-y-3">
          <Disclosure title="A real example from the catalog">
            <p className="text-sm text-muted-foreground">Your target roles ask for FP&amp;A depth.</p>
            <p className="mt-1 text-base font-medium">
              Kellogg exec-ed is offering Alumni plan members the Corporate Finance certificate through November, sourced by Priya R.
            </p>
          </Disclosure>
          <Disclosure title="What is included">
            <p className="text-sm text-muted-foreground">
              Your NextChapter Member account is free, before and after you land. Landed candidates also qualify for a $500 offer bonus.
              The Alumni plan adds the market check, benefits network and board listings. Free for 12 months to anyone placed through a Premium outplacement seat.
            </p>
          </Disclosure>
        </AudienceSection>
      </AudienceShell>
    </>
  )
}
