import type { Metadata } from 'next'
import Image from 'next/image'
import { OrganizationPageTemplate } from '@/components/organizations/OrganizationPageTemplate'
import type { AudienceTab } from '@/components/audience/audience-data'
import { canonical } from '@/lib/seo/canonical'

export const metadata: Metadata = {
  ...canonical('/coach-platform'),
  title: 'The White-Label Coach Platform',
  description:
    'Put your brand on the client tools you already run sessions around — full client view, session notes and directives, your logo and colors.',
}

// Ad-hoc AudienceTab, deliberately not registered in AUDIENCE_TABS — this is
// a nested upsell page linked from /coaches, not a peer top-level
// audience, so it should never show up in the shared audience-tab switcher.
const TAB: AudienceTab = {
  id: 'coach-platform',
  audience: 'coach-platform',
  eyebrow: 'For Coaches — Premium',
  headline: 'Your brand, on the platform your clients already use every day.',
  subhead:
    'The free tools on /coaches are a companion to your practice. This is the other direction: your name, your logo, your colors, on the client-facing tools you build sessions around.',
  points: [
    {
      lead: 'Full client view, not a summary card.',
      body: 'Grade history, work history, references, mood trend, and your own session log — everything you'
        + ' need before or during a call, in one place.',
    },
    {
      lead: 'Real session notes and directives.',
      body: 'Log what you actually discussed. Directives you write show up for the client — private notes never do.',
    },
    {
      lead: 'Your name and logo, not ours.',
      body: 'Practice branding on the tools your clients see — a real alternative to sending them into an unbranded product.',
    },
  ],
  contrastLabel: 'What this is, and what it isn’t yet:',
  contrastBody:
    'Session scheduling (Calendar/Meet booking) and billing aren’t live yet — join the waitlist and we’ll follow up as those ship.',
  formHeading: 'Get early access',
  formSubtext: 'Tell us about your practice and we’ll reach out as new features open up.',
  fields: [
    { name: 'fullName', label: 'Full name', type: 'text', required: true },
    { name: 'workEmail', label: 'Work email', type: 'email', required: true },
    { name: 'practiceName', label: 'Practice name', type: 'text', required: false },
    { name: 'clientVolume', label: 'How many active clients do you coach?', type: 'text', required: false },
  ],
  successMessage: 'Thanks — we’ll follow up as new features open up.',
}

export default function CoachPlatformPage() {
  return (
    <OrganizationPageTemplate
      tab={TAB}
      parent={{ href: '/coaches', label: 'For coaches' }}
      artifact={
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <div className="overflow-hidden rounded-xl border border-border bg-white">
            <Image
              src="/marketing/coach-full-client-view.png"
              width={1280}
              height={1394}
              alt="Full Client View for a coach's client, showing targeting, grade history, work history, references, recent moods, and a session log with notes and directives"
              className="w-full"
            />
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-white">
            <Image
              src="/marketing/coach-client-list.png"
              width={1280}
              height={473}
              alt="A coach's client list showing execution grade, trend, and week number for each client in an expandable row"
              className="w-full"
            />
          </div>
        </div>
      }
      footerLinks={[{ href: '/coaches', label: 'Free coach tools' }]}
    />
  )
}
