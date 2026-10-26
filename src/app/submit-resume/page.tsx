import { breadcrumbJsonLd } from '@/lib/seo/jsonld'
import { StructuredData } from '@/components/StructuredData'
import { pageH1, pageMetadata } from '@/lib/seo/keywords'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ResumeSubmissionForm } from '@/components/resume-submission/ResumeSubmissionForm'
import { PublicSiteHeader } from '@/components/marketing/PublicSiteChrome'
import { ReferredByBanner } from '@/components/marketing/ReferredByBanner'

export const metadata: Metadata = pageMetadata('/submit-resume')

export default function SubmitResumePage() {
  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={breadcrumbJsonLd([{ name: 'Submit your resume', path: '/submit-resume' }])} />
      <PublicSiteHeader />
      <ReferredByBanner />

      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight text-navy sm:text-4xl">
          {pageH1('/submit-resume', 'Get your resume in front of recruiters')}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Send us your resume and we&apos;ll review it for a fit with recruiters in our network. Free,
          no obligation — and no need to sign up first.
        </p>
        <div className="mt-8">
          <ResumeSubmissionForm />
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          Want a free assessment of your search instead?{' '}
          <Link href="/onboarding/desire" className="text-primary underline underline-offset-4">
            Get your grades
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
