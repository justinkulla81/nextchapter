import type { Metadata } from 'next'
import { PublicSiteHeader } from '@/components/marketing/PublicSiteChrome'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How NextChapter collects, uses, and protects your information.',
  alternates: { canonical: '/privacy-policy' },
}

const EFFECTIVE_DATE = 'October 25, 2026'

export default function PrivacyPolicyPage() {
  return (
    <>
    <PublicSiteHeader />
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight text-navy">Privacy Policy</h1>
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
          <h2 className="text-xl font-semibold text-navy">2. Connected Accounts (Gmail, Calendar, and LinkedIn)</h2>
          <p>
            You can optionally connect your Gmail, Calendar, and LinkedIn to turn on your
            networking and job application CRM — automatically tracking your outreach, application
            replies, interview invites, calls, and networking contacts instead of you logging each
            one by hand. These connections are optional, and every one of them can be disconnected
            at any time from Dashboard → Privacy.
          </p>
          <h3 className="text-lg font-semibold text-navy">Google permissions we request</h3>
          <p>
            Depending on how you use NextChapter, we may ask Google for the permissions
            (&quot;scopes&quot;) below. Google shows you exactly which ones are being requested
            before you agree, and you can revoke access at any time from Dashboard → Privacy or
            your Google Account&apos;s security settings.
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>openid</strong> — lets you sign in to NextChapter with your Google account,
              and lets us confirm which Google account is connected.
            </li>
            <li>
              <strong>email</strong> — reads your Google account&apos;s email address so we can
              create or match your NextChapter account, send you service emails, and show which
              address is connected.
            </li>
            <li>
              <strong>profile</strong> — reads your name to set up your NextChapter profile. Google
              also includes your profile picture with this permission; we do not use or display it.
            </li>
            <li>
              <strong>gmail.readonly</strong> — reads your Gmail messages so we can automatically
              find job search activity, such as outreach you send, application replies, interview
              invites, and recruiter emails, and log it in your application and networking tracker.
              We also use it to check recruiter and interview emails for signs of a fake job or
              recruiter scam (see &quot;Scam watch&quot; below). This permission cannot send, edit,
              or delete email. Unrelated messages are not used
              for any other purpose. We also use gmail.readonly to recognize emails from job boards
              and learning platforms you use (for example, an application confirmation from a job
              board or a course-completion email), so we can show which platforms you&apos;re active
              on.
            </li>
            <li>
              <strong>calendar.events.readonly</strong> — reads your calendar events so we can
              automatically log interviews, networking calls, and coaching sessions in your
              tracker. This permission cannot create, change, or delete events.
            </li>
            <li>
              <strong>gmail.send</strong> — used only by NextChapter team members, on their own
              NextChapter work accounts, to send outreach and follow-up emails they write and
              choose to send from our internal tools. We never request this permission from
              members, and it gives no access to any member&apos;s Gmail.
            </li>
            <li>
              <strong>calendar.events</strong> — used only by NextChapter team members, on their
              own NextChapter work accounts, to create and manage meetings and webinars, including
              video conferencing links. We never request this permission from members, and it
              gives no access to any member&apos;s Calendar.
            </li>
            <li>
              <strong>documents.readonly</strong> — used only by NextChapter team members, on their
              own NextChapter work accounts, to read the meeting notes Google Meet attaches to
              their own calls so the notes can be saved with the meeting record. We never request
              this permission from members, and it gives no access to any member&apos;s documents.
            </li>
          </ul>
          <h3 className="text-lg font-semibold text-navy">We never write to your Google account</h3>
          <p>
            Your Google connection is read-only. Through it, we never create, change, send, or
            delete anything in your Gmail or Calendar: we never send email from your address, and
            we never add, edit, or remove events on your calendar. The permissions we ask members
            for cannot do those things, and we never ask members for permission to write to Google.
            When a feature suggests something that belongs on your calendar, such as a conference
            deadline, we show it to you or give you a file to download, and you choose whether to
            add it yourself.
          </p>
          <h3 className="text-lg font-semibold text-navy">What Google data we keep</h3>
          <p>
            We read message content only to classify it, and we don&apos;t store email bodies or
            attachments. For each email we check in your inbox and sent mail, we keep the other
            person&apos;s email address, the subject, the date, the Gmail message and thread IDs,
            whether a resume was attached, and what we detected (for example, &quot;interview invite
            from Acme&quot;), or &quot;needs review&quot; when we couldn&apos;t tell. For emails from
            job boards and learning platforms, we also keep which platform sent it. For each calendar
            meeting you had with at least one other person, we keep the event title, time, duration,
            the other attendee&apos;s name and email address, and what we detected. We don&apos;t
            keep event descriptions. Your Google access tokens are encrypted at rest and deleted when
            you disconnect. This information is shown only to you. If you have a coach and choose to
            share with them, your coach sees counts of this activity and the applications on your
            list, never email subjects, senders, or contents.
          </p>
          <h3 className="text-lg font-semibold text-navy">Scam watch</h3>
          <p>
            If you connect Gmail, we automatically check incoming recruiter and interview emails for
            signs of a fake job or fake recruiter, such as a sender or link that doesn&apos;t belong
            to the company named, or requests for ID, bank details, or money. This check runs
            automatically, and no person reads your email for it. When an email looks fake, we keep
            only its sender, subject, date, and the reasons we flagged it, so we can show them to you
            on your Scam watch page and email you a warning. We don&apos;t keep the full message. You
            can mark an alert as legitimate, and you can stop scam watch at any time by disconnecting
            Gmail.
          </p>
          <p>
            NextChapter&apos;s use and transfer of information received from Google APIs will
            adhere to the{' '}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-4"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements.
          </p>
          <p>
            We use Google user data only to provide and improve the features described above, and
            we share it only with service providers that process it on our behalf to deliver those
            features, as needed for security, to comply with the law, or as part of a merger,
            acquisition, or sale of assets (with your consent where required). We do not sell it,
            use it for advertising, or use it to train generalized AI models, and no person at
            NextChapter reads it unless you give us permission, it is needed for security or to
            comply with the law, or it has been aggregated and anonymized for internal operations.
            We don&apos;t send your emails or calendar events, or their text, subjects, or senders,
            to any AI provider. Activity we detect from them, such as an interview at Acme or the
            name of a course you completed, may be included in the AI-generated reports we create
            for you (see Section 4).
            If we add features that need additional Google permissions, Google will ask for your
            consent before they are granted, and we will update this Policy.
          </p>
          <h3 className="text-lg font-semibold text-navy">Disconnecting and deleting your Google data</h3>
          <p>
            You can disconnect Gmail and Calendar at any time from Dashboard → Privacy. Disconnecting
            stops all syncing immediately, revokes NextChapter&apos;s access in your Google Account,
            and deletes your stored Google tokens. You can also remove access at{' '}
            <a
              href="https://myaccount.google.com/connections"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-4"
            >
              myaccount.google.com/connections
            </a>
            . To delete the data we created from your Gmail and Calendar, use{' '}
            <a href="/dashboard/privacy#google-data" className="text-primary underline underline-offset-4">
              &quot;Delete my Google data&quot;
            </a>{' '}
            on Dashboard → Privacy, or email{' '}
            <a href="mailto:support@launchyournextchapter.com" className="text-primary underline underline-offset-4">
              support@launchyournextchapter.com
            </a>
            . The button revokes our access and deletes your stored Google tokens, email and calendar
            records, scam alerts, and platform email records right away. If you email us, we delete
            them within 30 days of your request. Copies in our database backups are deleted within
            90 days. Applications, contacts, and the list of platforms you use stay, because they are
            your own records and are no longer linked to any email or event; you can remove them
            yourself at any time. If you ask us to delete your account, we delete all of it.
          </p>
          <h3 className="text-lg font-semibold text-navy">LinkedIn</h3>
          <p>
            LinkedIn connections are imported by you, not accessed by us. To build your networking
            list, you export your own connections file from LinkedIn and upload it to NextChapter —
            we never log into your LinkedIn account or access it directly. If you separately choose
            to connect LinkedIn to publish posts through NextChapter, that connection only allows
            us to publish content you write and submit yourself — it does not grant access to read
            your LinkedIn messages, connections, or activity.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-navy">3. How We Use Your Information</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>To generate your Market Reality Assessment, personalized action plan, resume feedback, and job-fit analysis.</li>
            <li>To operate features you use directly, such as reference requests, work samples, and the Community Board.</li>
            <li>To show your profile to employers on the Service, strictly according to the privacy setting you choose (see Section 5).</li>
            <li>To send you service emails — your report, reference requests, and reminders about finishing your account (you can opt out of reminder emails at any time via the unsubscribe link).</li>
            <li>To maintain, secure, and improve the Service.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-navy">4. How We Use AI to Process Your Information</h2>
          <p>
            We use Claude, an AI model provided by Anthropic, to analyze your resume, generate
            your Market Reality Assessment narratives, action plan, and job-fit
            feedback. Your resume text
            and profile details are sent to Anthropic&apos;s API solely to generate these results
            for you — Anthropic processes this data as our service provider and does not use it to
            train its models under our commercial agreement with them.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-navy">5. How We Share Your Information</h2>
          <p>
            <strong>We do not sell your personal data.</strong>{' '}
            We do not share it with data brokers or advertisers. We share information only in
            these circumstances:
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
          <h2 className="text-xl font-semibold text-navy">6. Your Choices &amp; Rights</h2>
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
            in Section 13.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-navy">7. Data Retention</h2>
          <p>
            We retain your information for as long as your account is active. When you ask us to
            delete your account (see Section 6), your profile and associated data are deleted from our
            production database within 30 days of your request. Google data you delete yourself with
            &quot;Delete my Google data&quot; is deleted right away (see Section 2). Some information may be retained where required by law or for legitimate
            business purposes, such as fraud prevention or resolving disputes.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-navy">8. Data Security</h2>
          <p>
            We use industry-standard technical and organizational measures to protect your
            information, including encryption in transit and access controls on our production
            systems. No method of storage or transmission is 100% secure, and we cannot guarantee
            absolute security.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-navy">9. Children&apos;s Privacy</h2>
          <p>
            The Service is intended for individuals who are at least 18 years old and legally
            eligible to work. We do not knowingly collect information from anyone under 18. If you
            believe a minor has provided us information, contact us and we will delete it.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-navy">10. No Guarantee of Employment Outcomes</h2>
          <p>
            Your Market Reality Assessment, action plan, and any AI-generated feedback are provided for
            informational and self-improvement purposes only. NextChapter is not an employment
            agency or recruiter, does not guarantee an interview, offer, or job placement of any
            kind, and is not responsible for the hiring decisions of employers who use the Service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-navy">11. $500 Hired Bounty Program Terms</h2>
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
          <h2 className="text-xl font-semibold text-navy">12. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. If we make material changes,
            we&apos;ll update the effective date above and, where appropriate, notify you directly.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-navy">13. Contact Us</h2>
          <p>
            Questions about this Policy or your data? Email{' '}
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
