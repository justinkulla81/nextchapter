import Link from 'next/link'
import { SiteNav } from '@/components/marketing/PublicSiteChrome'
import { OrganizationsHub } from '@/components/marketing/OrganizationsHub'
import { ContactForm } from '@/components/marketing/ContactForm'

// Prototype of the audience sub-homepage pattern, built on /for-organizations. Preview only.
export default function PublicOrganizationsPreview() {
  return (
    <div className="theme-redesign flex flex-1 flex-col bg-white text-ink">
      <header>
        <SiteNav />
      </header>
      <OrganizationsHub />
      <section id="contact" className="scroll-mt-6 bg-ink py-16 text-white">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="font-display text-2xl font-semibold">Talk to us</h2>
          <p className="mt-2 mb-6 text-white/80">
            Tell us what you are trying to do. We reply within one business day. The data behind it is in the monthly{' '}
            <Link href="/reports/latest" className="underline underline-offset-4">White Collar Employment Report</Link>.
          </p>
          <div className="rounded-2xl border border-border bg-white p-6 text-ink sm:p-8">
            <ContactForm initialAudience="ORGANIZATION" source="organizations" />
          </div>
        </div>
      </section>
    </div>
  )
}
