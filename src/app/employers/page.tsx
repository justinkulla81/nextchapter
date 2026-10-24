import type { Metadata } from 'next'
import { EmployerOverview } from '@/components/marketing/EmployerOverview'
import { PortalMarketingPage } from '@/components/marketing/PortalMarketingPage'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { EMPLOYERS } from '@/lib/marketing/portal-pages/employers'
import { portalMetadata } from '@/lib/marketing/portal-seo'

export const metadata: Metadata = portalMetadata(EMPLOYERS.seo)

// This used to forward to /outplacement. It is now the public overview of the three employer sections; /outplacement
// is the Outplacement section's own page, and /employer-home stays the signed-in front door.
const SECTION_PAGES = [
  { href: '/talent', label: 'Hiring', note: 'Post a role free' },
  { href: '/employees', label: 'Employees', note: 'Retention, learning and development' },
  { href: '/outplacement', label: 'Outplacement', note: 'Seats, reporting and compliance records' },
]

export default function EmployersPage() {
  const overview = (
    <section id="sections" aria-label="The three sections" className="mx-auto w-full max-w-4xl scroll-mt-6 px-6 pb-14">
      <EmployerOverview />
      <ul className="mt-6 flex flex-wrap gap-3">
        {SECTION_PAGES.map((s) => (
          <li key={s.href}>
            <TrackedLink
              href={s.href}
              event="portal_cta_clicked"
              properties={{ page: EMPLOYERS.content.analyticsKey, cta: `see_${s.label.toLowerCase()}`, location: 'sections' }}
              className="inline-flex h-11 items-center rounded-full border border-ink px-6 text-sm font-semibold text-ink hover:bg-muted"
            >
              {s.label}: {s.note}
            </TrackedLink>
          </li>
        ))}
      </ul>
    </section>
  )
  return <PortalMarketingPage content={{ ...EMPLOYERS.content, proof: { kind: 'live', node: overview } }} />
}
