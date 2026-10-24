import Link from 'next/link'
import { ContactForm } from '@/components/marketing/ContactForm'

const BENEFITS = [
  {
    title: 'Every resume your website attracts, in one place',
    body: 'A "Submit your resume" page in your logo, colors and font. Candidates get a clear answer. You get every resume, read and sorted.',
  },
  {
    title: 'Routed to the right recruiter',
    body: 'Set focus areas for the firm and for each recruiter. New resumes go to the person who searches that function, level and industry.',
  },
  {
    title: 'Candidates who are ready for you',
    body: 'Members who opt in bring a grade, references and a dossier. Ask them to finish their file, and share the ones who are not for you with other firms.',
  },
]

const SETUP = [
  ['We send you a link', 'You create a login. No call needed.'],
  ['Make it yours', 'Upload your logo, pick your color and font, add a banner photo.'],
  ['Add one button', 'Copy a link onto your site. Squarespace, WordPress, Wix and Webflow steps are built in.'],
  ['Connect your tools', 'Signed webhooks send each new resume to your ATS, CRM or Zapier.'],
]

// Landing-page section for /recruiters: the interactive product preview, how
// setup works, and a contact form.
export function RecruiterIntakeShowcase() {
  return (
    <div className="space-y-16">
      <div className="grid gap-4 sm:grid-cols-3">
        {BENEFITS.map((b) => (
          <div key={b.title} className="rounded-xl border border-border bg-white p-5">
            <p className="font-semibold text-navy">{b.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{b.body}</p>
          </div>
        ))}
      </div>

      <div>
        <h3 className="text-center text-lg font-bold tracking-tight text-navy">Click through it</h3>
        <p className="mx-auto mt-1 max-w-xl text-center text-sm text-muted-foreground">
          The candidate page, the confirmation, and the recruiter workspace. Add your own name, logo, photo and color at the top.
        </p>
        <div className="mt-4 overflow-hidden rounded-xl border border-border shadow-sm">
          <iframe
            src="/previews/recruiter-intake.html"
            title="Interactive preview of NextChapter for Recruiters"
            loading="lazy"
            className="h-[760px] w-full bg-white"
          />
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">Sample candidates and mandates.</p>
      </div>

      <div>
        <h3 className="text-center text-lg font-bold tracking-tight text-navy">Live in about ten minutes</h3>
        <ol className="mx-auto mt-5 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SETUP.map(([title, text], i) => (
            <li key={title} className="rounded-xl border border-border bg-off-white p-4">
              <span className="flex size-6 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white">{i + 1}</span>
              <p className="mt-3 font-semibold text-navy">{title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </li>
          ))}
        </ol>
      </div>

      <div id="contact" className="mx-auto max-w-3xl rounded-xl border border-border bg-white p-6 sm:p-8">
        <h3 className="text-xl font-bold tracking-tight text-navy">Talk to us</h3>
        <p className="mt-1 mb-5 text-sm text-muted-foreground">
          Tell us about your firm and we will send your registration link and walk you through it.{' '}
          <Link href="/contact" className="underline underline-offset-4">More ways to reach us</Link>.
        </p>
        <ContactForm initialAudience="COACH_RECRUITER" source="recruiters" />
      </div>
    </div>
  )
}
