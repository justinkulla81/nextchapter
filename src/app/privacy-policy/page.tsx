import Link from 'next/link'
import type { Metadata } from 'next'
import { Logo } from '@/components/Logo'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How NextChapter collects, uses, and protects your information.',
  alternates: { canonical: '/privacy-policy' },
}

const EFFECTIVE_DATE = 'July 13, 2026'

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="inline-block">
        <Logo className="text-2xl" />
      </Link>

      <h1 className="mt-8 text-3xl font-bold tracking-tight text-navy">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Effective date: {EFFECTIVE_DATE}</p>

      <div className="mt-8 space-y-8 text-base leading-relaxed text-foreground">
        <p>
          NextChapter (&quot;NextChapter,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;)
          operates launchyournextchapter.com and the NextChapter platform (the
          &quot;Service&quot;). This Privacy Policy explains what information we collect, how we
          use it, and the choices you have. By creating a profile or otherwise using the Service,
          you agree to the practices described here.
        </p>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-navy">1. Information We Collect</h2>
          <p>We collect information in three ways:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Information you provide directly:</strong> your name, email address, phone
              number, location, work history, career goals, target roles and compensation, resume
              and other documents you upload, work samples, interview and community post text, and
              your responses to the Market Reality Assessment.
            </li>
            <li>
              <strong>Information others provide about you:</strong> if you request a reference,
              the person you name will submit ratings and written feedback about their experience
              working with you.
            </li>
            <li>
              <strong>Information collected automatically:</strong> standard technical data such as
              IP address, browser type, and device information, collected via our hosting
              infrastructure, and a session cookie used solely to keep you signed in. We do not use
              advertising or third-party tracking cookies.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-navy">2. How We Use Your Information</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>To generate your Current Market Reality, personalized action plan, resume feedback, and job-fit analysis.</li>
            <li>To operate features you use directly, such as reference requests, work samples, and the Community Board.</li>
            <li>To show your profile to employers on the Service, strictly according to the privacy setting you choose (see Section 4).</li>
            <li>To send you service emails — your report, reference requests, and reminders about finishing your account (you can opt out of reminder emails at any time via the unsubscribe link).</li>
            <li>To maintain, secure, and improve the Service.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-navy">3. How We Use AI to Process Your Information</h2>
          <p>
            We use Claude, an AI model provided by Anthropic, to analyze your resume, generate
            your Current Market Reality narratives, action plan, and job-fit
            feedback. Your resume text
            and profile details are sent to Anthropic&apos;s API solely to generate these results
            for you — Anthropic processes this data as our service provider and does not use it to
            train its models under our commercial agreement with them.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-navy">4. How We Share Your Information</h2>
          <p>
            <strong>We do not sell your personal data.</strong> We do not share it with data
            brokers or advertisers. We share information only in these circumstances:
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>With employers on NextChapter</strong> — exactly as much as your chosen
              privacy tier allows. New profiles start fully <strong>Locked</strong> (invisible to
              everyone) while you build them out. You choose when and how much to reveal: full
              identity (Public), first name and last initial (Semi-Public), fully anonymized
              signal (Private), or visible only to specific companies you pre-approve (Stealth).
            </li>
            <li>
              <strong>With service providers</strong> who process data on our behalf under contract
              — Anthropic (AI analysis, described above), Supabase (database hosting and
              authentication), Resend (transactional email delivery), and Vercel (application
              hosting). We also query aggregate, non-personal labor market data from Adzuna and the
              U.S. Bureau of Labor Statistics; no candidate-identifying information is sent to
              them.
            </li>
            <li>
              <strong>If required by law</strong> — to comply with a legal obligation, protect our
              rights, or respond to a valid legal request.
            </li>
            <li>
              <strong>In a business transfer</strong> — if NextChapter is involved in a merger,
              acquisition, or sale of assets, your information may be transferred as part of that
              transaction, subject to this Policy.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-navy">5. Your Choices &amp; Rights</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>Change your visibility setting at any time from Dashboard → Privacy.</li>
            <li>Update or correct your profile information at any time.</li>
            <li>
              <strong>Deactivate your account</strong> at any time, immediately and without
              contacting support, from Dashboard → Privacy → Danger Zone — this makes your account
              unusable but keeps your data intact. For a permanent deletion of your profile,
              resume, references, work samples, and reports, email
              support@launchyournextchapter.com.
            </li>
            <li>Unsubscribe from reminder emails via the link in any reminder email.</li>
          </ul>
          <p>
            If you are located in a jurisdiction that grants additional rights over your personal
            data (such as the right to access, correct, or restrict processing of your data), you
            can exercise those rights using the controls above, or by contacting us at the address
            in Section 10.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-navy">6. Data Retention</h2>
          <p>
            We retain your information for as long as your account is active. When you delete your
            account, your profile and associated data are deleted immediately from our production
            database. Some information may be retained where required by law or for legitimate
            business purposes, such as fraud prevention or resolving disputes.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-navy">7. Data Security</h2>
          <p>
            We use industry-standard technical and organizational measures to protect your
            information, including encryption in transit and access controls on our production
            systems. No method of storage or transmission is 100% secure, and we cannot guarantee
            absolute security.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-navy">8. Children&apos;s Privacy</h2>
          <p>
            The Service is intended for individuals who are at least 18 years old and legally
            eligible to work. We do not knowingly collect information from anyone under 18. If you
            believe a minor has provided us information, contact us and we will delete it.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-navy">9. No Guarantee of Employment Outcomes</h2>
          <p>
            Your Current Market Reality, action plan, and any AI-generated feedback are provided for
            informational and self-improvement purposes only. NextChapter is not an employment
            agency or recruiter, does not guarantee an interview, offer, or job placement of any
            kind, and is not responsible for the hiring decisions of employers who use the Service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-navy">10. $500 Hired Bounty Program Terms</h2>
          <p>
            Candidates who report landing a job through NextChapter may be eligible for a one-time
            $500 bounty. Eligibility requires submitting real role details and a genuine offer
            letter or equivalent written confirmation of employment (e.g. an official offer email
            from the hiring company) for review. We may verify the details you submit, including
            contacting the listed employer to confirm the offer is genuine.
          </p>
          <p>
            Submitting a false, altered, or fraudulent offer letter, or misrepresenting role
            details, disqualifies the claim and may result in account termination. Approval,
            rejection, and payment of any bounty is at NextChapter&apos;s sole discretion; submitting
            a claim does not guarantee payment. Payment, once approved, is issued manually via the
            payment method and handle you provide — NextChapter is not responsible for delays or
            errors caused by incorrect payment information.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-navy">11. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. If we make material changes,
            we&apos;ll update the effective date above and, where appropriate, notify you directly.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-navy">12. Contact Us</h2>
          <p>
            Questions about this Policy or your data? Email{' '}
            <a href="mailto:hello@launchyournextchapter.com" className="text-primary underline underline-offset-4">
              hello@launchyournextchapter.com
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  )
}
