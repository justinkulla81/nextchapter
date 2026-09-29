import type { Metadata } from 'next'
import type { ContactAudience } from '@prisma/client'
import { PublicSiteHeader, PublicSiteFooter } from '@/components/marketing/PublicSiteChrome'
import { ContactForm } from '@/components/marketing/ContactForm'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { COMPANY_LINKEDIN_URL, CONTACT_EMAIL, SUPPORT_EMAIL } from '@/lib/contact/constants'

export const metadata: Metadata = {
  title: 'Contact us',
  description: 'Contact NextChapter: job seekers, organizations, coaches, recruiters and press.',
  alternates: { canonical: '/contact' },
  openGraph: { title: 'Contact NextChapter', url: 'https://launchyournextchapter.com/contact' },
}

// ?as=organization (from the About page's "Work with us") preselects the audience.
const AS: Record<string, ContactAudience> = {
  candidate: 'CANDIDATE', organization: 'ORGANIZATION', coach: 'COACH_RECRUITER', recruiter: 'COACH_RECRUITER', press: 'OTHER',
}

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  const { as } = await searchParams
  const initialAudience = (as && AS[as.toLowerCase()]) || 'CANDIDATE'

  return (
    <div className="flex flex-1 flex-col bg-white">
      <PublicSiteHeader current="contact" />
      <main className="mx-auto w-full max-w-6xl px-6 py-16">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-brand">Contact us</p>
        <h1 className="mt-3 text-balance text-4xl font-bold tracking-tight text-navy">Tell us a little about you</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">We’ll send your note to the right person.</p>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <ContactForm initialAudience={initialAudience} />
          <aside aria-label="Other ways to reach us" className="flex flex-col gap-6 self-start rounded-xl bg-off-white p-6 text-sm">
            <div>
              <h2 className="font-semibold text-navy">Email</h2>
              <p className="mt-1 select-all font-medium text-foreground">{CONTACT_EMAIL}</p>
            </div>
            <div>
              <h2 className="font-semibold text-navy">Help with your account</h2>
              <p className="mt-1 select-all font-medium text-foreground">{SUPPORT_EMAIL}</p>
            </div>
            <div>
              <h2 className="font-semibold text-navy">Organizations</h2>
              <p className="mt-1 text-muted-foreground">
                Outplacement firms, workforce boards, nonprofits and employers: choose “An organization” and we’ll set up a walkthrough.
              </p>
            </div>
            <div>
              <h2 className="font-semibold text-navy">Follow us</h2>
              <TrackedLink href={COMPANY_LINKEDIN_URL} event="company_linkedin_clicked" properties={{ page: 'contact', placement: 'sidebar' }} className="mt-1 inline-block font-medium text-brand underline underline-offset-4">
                NextChapter on LinkedIn
              </TrackedLink>
            </div>
          </aside>
        </div>
      </main>
      <PublicSiteFooter page="contact" />
    </div>
  )
}
