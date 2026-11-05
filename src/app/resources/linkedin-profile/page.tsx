import type { Metadata } from 'next'
import Link from 'next/link'
import { SeoPage, H2, LINK } from '@/components/seo/SeoPage'
import { AuthorByline } from '@/components/seo/AuthorByline'
import { NewsletterSignup } from '@/components/marketing/NewsletterSignup'
import { ProfileChecklist } from '@/components/linkedin/ProfileChecklist'
import { AboutFold, ChecklistOverview, HeadlineAnatomy, KeywordMap, WeekRhythm } from '@/components/linkedin/Infographics'
import { ABOUT_LIMIT, CHECKS, FAQ, HEADLINE_LIMIT, LINKEDIN_GUIDE_PATH, LINKEDIN_GUIDE_UPDATED, SKIP_LIST } from '@/lib/linkedin/guide'
import { pageH1, pageMetadata } from '@/lib/seo/keywords'
import { breadcrumbJsonLd } from '@/lib/seo/jsonld'

// The public LinkedIn profile guide. Our own wording and pictures (src/components/linkedin); the member version is /dashboard/linkedin.
// Content and limits: src/lib/linkedin/guide.ts. The one registration ask is the frame's navy box; the email box below is the weekly tip.

export const metadata: Metadata = pageMetadata(LINKEDIN_GUIDE_PATH)

const TRAIL = [{ name: 'Resources', path: '/resources' }, { name: 'LinkedIn profile', path: LINKEDIN_GUIDE_PATH }]
const P = 'max-w-3xl space-y-3 text-base leading-relaxed text-navy'

export default function LinkedInProfilePage() {
  return (
    <SeoPage
      trail={TRAIL}
      h1={pageH1(LINKEDIN_GUIDE_PATH, 'How to optimize your LinkedIn profile for a job search')}
      look="audience"
      lede={
        <>
          <p>
            Recruiters find people by searching, then decide in seconds whether to read on. Your profile has two jobs: show up for the right searches, and make the person who
            lands on it want to talk to you. Below are {CHECKS.length} checks, in four groups, each with the reason for it. Do them in any order and tick them off as you go.
          </p>
          <AuthorByline updated={LINKEDIN_GUIDE_UPDATED} className="mt-4" />
        </>
      }
      jsonLd={[
        { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
        breadcrumbJsonLd(TRAIL),
      ]}
    >
      <section aria-labelledby="map" className="mt-8">
        <h2 id="map" className="sr-only">The checklist at a glance</h2>
        <ChecklistOverview />
      </section>

      <section aria-labelledby="headline" className="mt-12">
        <h2 id="headline" className={H2}>Headline: the line people read first</h2>
        <div className={`${P} mt-4`}>
          <p>
            LinkedIn fills the headline with your latest job title. Replace it. It sits beside your name in search results, in comments and in connection requests, so it is read far more often than anything else you write.
            You get {HEADLINE_LIMIT} characters. Say what you do, who for, one piece of proof, and two or three of the terms recruiters type.
          </p>
        </div>
        <div className="mt-5 max-w-4xl"><HeadlineAnatomy /></div>
        <div className={`${P} mt-5`}>
          <p className="font-semibold">Leave out:</p>
          <ul className="list-disc space-y-1 pl-5">{SKIP_LIST.map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
      </section>

      <section aria-labelledby="about" className="mt-12">
        <h2 id="about" className={H2}>About: write the first three lines for a stranger</h2>
        <div className={`${P} mt-4`}>
          <p>
            Visitors see only the first few lines before “see more”, so the opening has to earn the click. Start with a result, the problem you solve, or a moment that made you choose this work. Write in the first
            person and in plain words: it is a note from you, not a press release. Below the fold, say who you help, how, and back it with numbers. You have {ABOUT_LIMIT.toLocaleString('en-US')} characters; use fewer if the point is made.
          </p>
          <p>End with how to reach you, written into the text. People who are not yet connected to you may not see your contact details otherwise.</p>
        </div>
        <div className="mt-5 max-w-4xl"><AboutFold /></div>
      </section>

      <section aria-labelledby="keywords" className="mt-12">
        <h2 id="keywords" className={H2}>Keywords: how recruiters find you</h2>
        <div className={`${P} mt-4`}>
          <p>
            Open five postings for the job you want and look for the phrases they share. Those are the words a recruiter types into search. Use them where they are true: in the headline, the About, what you wrote under each job, and your skills.
            Repeating a real phrase a handful of times across the profile helps you get found. Repeating it until the page reads like a list hurts you with the person who is reading it.
          </p>
          <p>
            Skills deserve their own pass. LinkedIn allows up to 50. List at least five, lead with the ones your target jobs ask for, and tie each to a role so it is backed by something you did.
          </p>
        </div>
        <div className="mt-5 max-w-4xl"><KeywordMap /></div>
      </section>

      <section aria-labelledby="checklist" className="mt-12">
        <h2 id="checklist" className={H2}>Your checklist</h2>
        <p className={`${P} mt-4`}>Tick each one as you do it. Your ticks stay in this browser; nothing is sent to us.</p>
        <div className="mt-5 max-w-4xl"><ProfileChecklist surface="public" /></div>
      </section>

      <section aria-labelledby="rhythm" className="mt-12">
        <h2 id="rhythm" className={H2}>After the profile: fifteen minutes a day</h2>
        <div className={`${P} mt-4`}>
          <p>
            A finished profile that nobody sees helps little. Reach comes from a small daily habit: comment before you message, follow the people who hire for the work you want, and post about real work once a week.
            A thoughtful comment on someone’s post makes your name familiar, so when you do write to them, it is not cold.
          </p>
        </div>
        <div className="mt-5 max-w-4xl"><WeekRhythm /></div>
        <p className={`${P} mt-4`}>
          Searching after a layoff? Say so plainly in one line, then say what you are focused on next. See <Link href="/resources/unemployed" className={LINK}>job search while unemployed</Link> and{' '}
          <Link href="/tools/resume-check" className={LINK}>check how a system reads your résumé</Link>, so the two documents tell the same story.
        </p>
      </section>

      <section aria-labelledby="faq" className="mt-12">
        <h2 id="faq" className={H2}>Questions people ask</h2>
        <dl className="mt-4 max-w-3xl space-y-5">
          {FAQ.map((f) => (
            <div key={f.q}>
              <dt className="text-base font-semibold text-navy">{f.q}</dt>
              <dd className="mt-1 text-base text-navy">{f.a}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
          Character limits are LinkedIn’s own and can change; check the edit box on your profile. The rest is our advice, and each check says why.
        </p>
      </section>

      <section aria-labelledby="tip" className="mt-12 rounded-3xl bg-white p-6">
        <h2 id="tip" className="sr-only">Weekly tip by email</h2>
        <NewsletterSignup source="linkedin-guide" variant="tips" />
      </section>
    </SeoPage>
  )
}
