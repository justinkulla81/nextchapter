import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicSiteHeader } from '@/components/marketing/PublicSiteChrome'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms that govern your use of NextChapter.',
  alternates: { canonical: '/terms' },
}

const EFFECTIVE_DATE = 'October 7, 2026'
const GOVERNING_STATE = 'Delaware'

export default function TermsOfServicePage() {
  return (
    <>
    <PublicSiteHeader />
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight text-navy">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Effective date: {EFFECTIVE_DATE}</p>

      <div className="mt-8 space-y-8 text-base leading-relaxed text-foreground">
        <p>
          These Terms of Service (the &quot;Terms&quot;) are a binding agreement between you and
          NextChapter (&quot;NextChapter,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;)
          and govern your access to and use of launchyournextchapter.com, the NextChapter
          platform, and any related websites, applications, emails, reports, coaching, and
          services (together, the &quot;Service&quot;). By creating an account, clicking to
          accept, or otherwise accessing or using the Service, you agree to these Terms and to
          our{' '}
          <Link href="/privacy-policy" className="text-primary underline underline-offset-4">
            Privacy Policy
          </Link>
          . If you do not agree, do not use the Service.
        </p>
        <p className="rounded-md border border-border bg-muted/40 p-4 text-sm">
          <strong>Please read Section 17 carefully.</strong> It requires that most disputes
          between you and NextChapter be resolved by binding individual arbitration rather than
          in court, and it waives your right to participate in a class action or jury trial. You
          may opt out of arbitration within 30 days as described in Section 17.
        </p>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-navy">1. Eligibility</h2>
          <p>
            You must be at least 18 years old and able to form a binding contract to use the
            Service. If you use the Service on behalf of a company, university, workforce board,
            or other organization, you represent that you have authority to bind that
            organization to these Terms, and &quot;you&quot; includes that organization. We may
            refuse access to anyone, at any time, for any reason permitted by law.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-navy">2. Your Account</h2>
          <p>
            You agree to provide accurate, current, and complete information and to keep it up to
            date. You are responsible for safeguarding your login credentials and for all activity
            that occurs under your account, whether or not you authorized it. Notify us
            immediately at support@launchyournextchapter.com if you suspect unauthorized access.
            We are not liable for any loss arising from your failure to protect your account.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-navy">3. The Service</h2>
          <p>
            NextChapter provides career tools for job seekers and related tools for coaches,
            employers, recruiters, and organizations, including market assessments, action plans,
            resume and job-fit feedback, application and networking tracking, coaching,
            references, community features, and candidate profiles. We may add, change, suspend,
            or discontinue any part of the Service, including features available on paid plans,
            at any time, with or without notice, and without liability to you.
          </p>
          <p>
            Some features are offered as a beta, preview, or early access. Those features are
            provided without any commitment and may be changed or removed at any time.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-navy">4. No Guarantee of Employment; Not Professional Advice</h2>
          <p>
            NextChapter is not an employment agency, staffing firm, or recruiter acting on your
            behalf, and it does not guarantee an interview, offer, job placement, salary, or any
            other result. Employers, recruiters, and other third parties make their own decisions,
            and we are not responsible for them.
          </p>
          <p>
            Content provided through the Service — including assessments, scores, grades, points,
            market data, compensation estimates, and coaching — is for general informational and
            self-improvement purposes only. It is not legal, financial, tax, immigration, or other
            professional advice, and you should not rely on it as such. You are solely responsible
            for your decisions and their outcomes.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-navy">5. AI-Generated Output</h2>
          <p>
            The Service uses artificial intelligence, including models provided by third parties,
            to generate analysis, feedback, drafts, and other output (&quot;Output&quot;). Output
            is generated automatically, may be inaccurate, incomplete, or out of date, and may not
            be unique. You are responsible for reviewing Output and deciding whether and how to
            use it, including before sending anything to an employer or posting it publicly.
            NextChapter makes no warranty regarding Output and is not liable for any use of it.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-navy">6. Your Content</h2>
          <p>
            &quot;Your Content&quot; means anything you submit to the Service, including your
            profile, resume, documents, work samples, messages, posts, and responses. You keep
            ownership of Your Content. You grant NextChapter a worldwide, non-exclusive,
            royalty-free, fully paid, transferable, and sublicensable license to host, store,
            copy, process, modify, create derivative works from, display, and distribute Your
            Content as needed to operate, provide, secure, and improve the Service, and as
            permitted by your privacy settings and our Privacy Policy. This license continues for
            as long as Your Content remains on the Service and, for aggregated or de-identified
            data, after that.
          </p>
          <p>
            You represent that you own or have all rights needed to submit Your Content, that it
            is accurate and not misleading, and that it does not violate any law or anyone
            else&apos;s rights. We may remove or refuse to display any content at our discretion,
            but we have no obligation to monitor or review it.
          </p>
          <p>
            If you send us feedback or suggestions, we may use them for any purpose without
            compensation or obligation to you.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-navy">7. Connected Accounts and Third-Party Services</h2>
          <p>
            You may choose to connect third-party accounts such as Google (Gmail and Calendar) or
            LinkedIn, or upload data exported from them. By doing so, you authorize us to access
            and use that data as described in our Privacy Policy, and you remain responsible for
            complying with those third parties&apos; terms. The Service may also link to or
            integrate third-party websites, job listings, and services. We do not control and are
            not responsible for any third-party service, its content, or its availability, and
            your use of it is at your own risk.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-navy">8. References, Community, and Other Users</h2>
          <p>
            Features such as references, the Community Board, coaching, and employer or recruiter
            access involve other people. You are solely responsible for your interactions with
            other users. NextChapter does not verify, endorse, or guarantee any user, coach,
            employer, recruiter, job listing, or reference, and is not responsible for what
            other users say or do. When you request a reference, you authorize the person you
            name to provide feedback about you and authorize us to display it according to your
            settings.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-navy">9. Coaches, Employers, Recruiters, and Organizations</h2>
          <p>
            If you use the Service as a coach, employer, recruiter, or organization, you
            additionally agree to: use candidate information only for legitimate coaching or
            hiring purposes; comply with all applicable employment, anti-discrimination, privacy,
            and automated-decision laws; not export, scrape, resell, or share candidate data
            outside the Service except as expressly permitted; respect each candidate&apos;s
            privacy settings; and not use the Service as the sole basis for any employment
            decision. You are solely responsible for your hiring decisions. Separate order forms
            or agreements may apply to your use and will control where they conflict with these
            Terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-navy">10. Acceptable Use</h2>
          <p>You agree not to, and not to help anyone else to:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>violate any law or anyone&apos;s rights, including intellectual property and privacy rights;</li>
            <li>submit false, misleading, or fraudulent information, including fake credentials, references, or offer letters;</li>
            <li>impersonate any person or misrepresent your affiliation with anyone;</li>
            <li>harass, threaten, discriminate against, or harm others, or post content that is unlawful, hateful, or sexually explicit;</li>
            <li>scrape, crawl, or use automated means to access or collect data from the Service without our written permission;</li>
            <li>reverse engineer, decompile, or attempt to derive source code or model behavior from the Service, except where that restriction is prohibited by law;</li>
            <li>use the Service or its Output to build a competing product or to train AI models;</li>
            <li>interfere with, disrupt, overload, or probe the security of the Service, or bypass any access control or usage limit;</li>
            <li>upload malware or any harmful code;</li>
            <li>send spam or unsolicited commercial messages through the Service; or</li>
            <li>resell, sublicense, or share access to your account or the Service.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-navy">11. Paid Plans, Billing, and Refunds</h2>
          <p>
            Some parts of the Service require payment. Current prices are listed on our{' '}
            <Link href="/pricing" className="text-primary underline underline-offset-4">
              Pricing
            </Link>{' '}
            page or in your order. By purchasing, you authorize us and our payment processor to
            charge your payment method for all fees and applicable taxes.
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Automatic renewal.</strong> Subscriptions renew automatically at the end of
              each billing period at the then-current rate until you cancel. You can cancel at any
              time from your account settings or by contacting us; cancellation takes effect at the
              end of the current billing period.
            </li>
            <li>
              <strong>No refunds.</strong> Except where required by law, all fees are
              non-refundable, including for partial billing periods, unused features, or coaching
              sessions you did not schedule or attend. We may issue refunds or credits at our sole
              discretion, and doing so once does not obligate us to do so again.
            </li>
            <li>
              <strong>Price changes.</strong> We may change prices at any time. Changes to an
              active subscription take effect at your next renewal after we notify you.
            </li>
            <li>
              <strong>Failed payments.</strong> If a payment fails, we may suspend or downgrade
              your access until it is resolved.
            </li>
            <li>
              <strong>Free trials and promotions.</strong> Unless you cancel before a free trial
              ends, you will be charged the applicable fee. Promotions are subject to their own
              terms and may be withdrawn at any time.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-navy">12. Rewards, Bounties, and Referral Programs</h2>
          <p>
            From time to time we may offer rewards such as the Hired Bounty, referral rewards,
            points, or grades. These programs are subject to the program-specific terms we
            publish (including those in our Privacy Policy), may require verification, and may be
            changed, suspended, or ended at any time. Points, grades, and similar features have no
            cash value. Eligibility, approval, and payment of any reward are at NextChapter&apos;s
            sole discretion, and fraud or abuse will result in forfeiture and may result in
            account termination. You are responsible for any taxes on rewards you receive.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-navy">13. Our Intellectual Property</h2>
          <p>
            The Service, including its software, design, text, graphics, data compilations,
            reports, trademarks, and logos, is owned by NextChapter or its licensors and is
            protected by intellectual property laws. Subject to these Terms, we grant you a
            limited, revocable, non-exclusive, non-transferable license to use the Service for
            your own personal or internal business purposes. All rights not expressly granted
            are reserved. You may use Output we generate for you for your own job search or
            internal purposes.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-navy">14. Termination</h2>
          <p>
            You may stop using the Service and deactivate your account at any time. We may
            suspend or terminate your access to all or part of the Service at any time, for any
            reason or no reason, with or without notice, including if we believe you have
            violated these Terms. Upon termination, your right to use the Service ends
            immediately, and we are not obligated to refund any fees or retain Your Content,
            except as stated in our Privacy Policy or required by law. Sections that by their
            nature should survive termination will survive, including Sections 4–6 and 12–19.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-navy">15. Disclaimers</h2>
          <p className="uppercase">
            The Service, Output, and all content are provided &quot;as is&quot; and &quot;as
            available,&quot; without warranties of any kind, whether express, implied, or
            statutory, including any implied warranties of merchantability, fitness for a
            particular purpose, title, non-infringement, accuracy, and any warranties arising
            from course of dealing or usage of trade. NextChapter does not warrant that the
            Service will be uninterrupted, secure, error-free, or free of harmful components,
            that any data will be preserved or accurate, or that the Service will meet your
            requirements or produce any particular result.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-navy">16. Limitation of Liability</h2>
          <p className="uppercase">
            To the maximum extent permitted by law, NextChapter and its affiliates, officers,
            employees, agents, licensors, and service providers will not be liable for any
            indirect, incidental, special, consequential, exemplary, or punitive damages, or for
            any loss of profits, revenue, wages, employment opportunities, data, or goodwill,
            arising out of or relating to these Terms or the Service, however caused and under
            any theory of liability, even if advised of the possibility of such damages. Our
            total liability for all claims arising out of or relating to these Terms or the
            Service will not exceed the greater of (a) the amounts you paid us for the Service in
            the 12 months before the event giving rise to the claim, or (b) one hundred U.S.
            dollars ($100).
          </p>
          <p>
            Some jurisdictions do not allow certain exclusions or limitations, so some of the
            above may not apply to you; in that case, our liability is limited to the fullest
            extent permitted by law.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-navy">17. Dispute Resolution; Binding Arbitration; Class Action Waiver</h2>
          <p>
            <strong>Informal resolution first.</strong> Before filing any claim, you agree to
            contact us at contact@launchyournextchapter.com with a description of the dispute and
            try to resolve it informally for at least 60 days.
          </p>
          <p>
            <strong>Arbitration.</strong> Except as provided below, any dispute, claim, or
            controversy arising out of or relating to these Terms or the Service will be resolved
            by final and binding arbitration administered by the American Arbitration Association
            under its Consumer Arbitration Rules (or, for business users, its Commercial
            Arbitration Rules), before a single arbitrator. The arbitration may be conducted by
            video, by phone, or on written submissions. The Federal Arbitration Act governs this
            Section. Judgment on the award may be entered in any court of competent jurisdiction.
          </p>
          <p>
            <strong>Exceptions.</strong> Either party may bring an individual claim in small
            claims court, and either party may seek injunctive or other equitable relief in court
            to protect its intellectual property or to stop unauthorized use of the Service.
          </p>
          <p>
            <strong>Class action and jury waiver.</strong> You and NextChapter agree that each may
            bring claims against the other only in an individual capacity, and not as a plaintiff
            or class member in any purported class, collective, consolidated, or representative
            proceeding. The arbitrator may not consolidate claims or preside over any form of
            class or representative proceeding. You and NextChapter each waive the right to a
            jury trial.
          </p>
          <p>
            <strong>Opt-out.</strong> You may opt out of this arbitration agreement by emailing
            contact@launchyournextchapter.com with the subject line &quot;Arbitration
            Opt-Out&quot; and your name and account email within 30 days of first accepting these
            Terms. Opting out does not affect any other part of these Terms.
          </p>
          <p>
            <strong>Time limit.</strong> To the extent permitted by law, any claim must be brought
            within one year after it arises, or it is permanently barred.
          </p>
          <p>
            If the class action waiver is found unenforceable for any claim, that claim must be
            severed and decided in court, and the rest of this Section remains in effect.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-navy">18. Indemnification</h2>
          <p>
            You agree to defend, indemnify, and hold harmless NextChapter and its affiliates,
            officers, employees, agents, and licensors from and against any claims, liabilities,
            damages, losses, and expenses, including reasonable attorneys&apos; fees, arising out
            of or relating to Your Content, your use of the Service, your violation of these
            Terms or any law, or your violation of anyone else&apos;s rights. We may assume the
            exclusive defense of any matter subject to indemnification, and you agree to
            cooperate with our defense.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-navy">19. Governing Law and Venue</h2>
          <p>
            These Terms are governed by the laws of the State of {GOVERNING_STATE} and applicable
            U.S. federal law, without regard to conflict-of-law rules. For any dispute not
            subject to arbitration, you and NextChapter consent to the exclusive jurisdiction of
            the state and federal courts located in {GOVERNING_STATE}.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-navy">20. Changes to These Terms</h2>
          <p>
            We may update these Terms from time to time. When we do, we will update the effective
            date above and, for material changes, may notify you by email or through the Service.
            Changes take effect when posted unless we say otherwise. Your continued use of the
            Service after changes take effect means you accept the updated Terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-navy">21. General</h2>
          <p>
            These Terms, together with our Privacy Policy and any order forms or program terms
            referenced here, are the entire agreement between you and NextChapter regarding the
            Service. If any provision is found unenforceable, it will be enforced to the maximum
            extent possible and the rest will remain in effect. Our failure to enforce any
            provision is not a waiver. You may not assign these Terms without our prior written
            consent; we may assign them without restriction, including in connection with a
            merger, acquisition, or sale of assets. We are not liable for any delay or failure
            caused by events beyond our reasonable control. No agency, partnership, joint venture,
            or employment relationship is created by these Terms. You agree that we may provide
            notices to you electronically, including by email or through the Service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-navy">22. Contact Us</h2>
          <p>
            Questions about these Terms? Email{' '}
            <a href="mailto:contact@launchyournextchapter.com" className="text-primary underline underline-offset-4">
              contact@launchyournextchapter.com
            </a>
            .
          </p>
        </section>
      </div>
    </div>
    </>
  )
}
