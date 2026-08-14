import type { Metadata } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { ResumeSubmissionForm } from '@/components/resume-submission/ResumeSubmissionForm'

export const metadata: Metadata = {
  title: 'Submit Your Resume — NextChapter',
  description:
    'Send your resume to NextChapter and we\'ll pass strong matches along to recruiters in our network — no cost, no obligation.',
  alternates: { canonical: '/submit-resume' },
}

export default function SubmitResumePage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
          <Link href="/">
            <Logo className="text-2xl" />
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/" className="text-muted-foreground hover:text-foreground">
              Home
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight text-navy sm:text-4xl">
          Get your resume in front of recruiters
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Send us your resume and we&apos;ll review it for a fit with recruiters in our network. No
          cost, no obligation — and no need to sign up first.
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
