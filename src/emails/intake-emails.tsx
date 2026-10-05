import { IntakeEmailLayout, TextParagraphs, intakeButton } from './intake-email-layout'

// NextChapter Talent email templates (spec F2–F4, F6 fit alert).

export function IntakeSubmissionConfirmationEmail({
  firstName,
  firmName,
  recruiterName,
  claimUrl,
  unsubscribeUrl,
}: {
  firstName: string
  firmName: string
  recruiterName: string | null
  claimUrl: string
  unsubscribeUrl: string
}) {
  const who = recruiterName ? `${recruiterName} at ${firmName}` : firmName
  return (
    <IntakeEmailLayout
      heading={firmName}
      subheading="Powered by NextChapter"
      footerNote={`You received this because you submitted your resume to ${firmName} on their NextChapter page.`}
      unsubscribeUrl={unsubscribeUrl}
    >
      <p>Hi {firstName || 'there'},</p>
      <p>{who} has your resume. If there is a fit with a current search, you will hear from them directly.</p>
      <p>
        Your free NextChapter profile is ready. It gives you a read on your job market and a plan for your search,
        and you decide what {firmName} can see.
      </p>
      <p>
        <a href={claimUrl} style={intakeButton}>
          Open my free profile
        </a>
      </p>
    </IntakeEmailLayout>
  )
}

export function IntakeReplyEmail({
  body,
  firmName,
  claimUrl,
  unsubscribeUrl,
}: {
  body: string
  firmName: string
  claimUrl: string | null
  unsubscribeUrl: string
}) {
  return (
    <IntakeEmailLayout
      heading={firmName}
      subheading="Powered by NextChapter"
      footerNote={`Sent by NextChapter on behalf of ${firmName}. Reply to this email to reach them directly.`}
      unsubscribeUrl={unsubscribeUrl}
    >
      <TextParagraphs text={body} />
      {claimUrl && (
        <p>
          <a href={claimUrl} style={intakeButton}>
            Get my free market read and plan
          </a>
        </p>
      )}
    </IntakeEmailLayout>
  )
}

export function IntakeClaimReminderEmail({
  firstName,
  firmName,
  claimUrl,
  unsubscribeUrl,
  final,
}: {
  firstName: string
  firmName: string
  claimUrl: string
  unsubscribeUrl: string
  final: boolean
}) {
  return (
    <IntakeEmailLayout
      heading="NextChapter"
      footerNote={`You received this because your resume was shared with ${firmName}. ${final ? 'This is the last reminder.' : ''}`}
      unsubscribeUrl={unsubscribeUrl}
    >
      <p>Hi {firstName || 'there'},</p>
      <p>
        Your free NextChapter profile from {firmName} is still waiting. It includes a read on your job market and a
        plan for your search.
      </p>
      <p>
        <a href={claimUrl} style={intakeButton}>
          Open my free profile
        </a>
      </p>
      <p>Unclaimed profiles and resumes are deleted after 60 days.</p>
    </IntakeEmailLayout>
  )
}

export function IntakeFitAlertEmail({
  recruiterFirstName,
  candidateName,
  searchTitle,
  summary,
  reasons,
  reviewUrl,
}: {
  recruiterFirstName: string
  candidateName: string
  searchTitle: string
  summary: string[]
  reasons: string[]
  reviewUrl: string
}) {
  return (
    <IntakeEmailLayout
      heading="NextChapter Talent"
      subheading={`Fit for ${searchTitle}`}
      footerNote="You get this alert when a new resume matches every criterion on one of your open searches. Close the search to stop alerts for it."
    >
      <p>Hi {recruiterFirstName},</p>
      <p>
        <strong>{candidateName}</strong> just came in and matches every criterion on {searchTitle}.
      </p>
      {summary.length > 0 && (
        <ul>
          {summary.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
      <p style={{ fontSize: '14px', color: '#4a5568' }}>Why: {reasons.join('; ')}</p>
      <p>
        <a href={reviewUrl} style={intakeButton}>
          Review {candidateName.split(' ')[0] || 'candidate'}
        </a>
      </p>
    </IntakeEmailLayout>
  )
}

export function IntakeApprovalDigestEmail({
  recruiterFirstName,
  items,
  reviewUrl,
  sendingEnabled,
}: {
  recruiterFirstName: string
  items: { candidateName: string; kind: string; reason: string }[]
  reviewUrl: string
  sendingEnabled: boolean
}) {
  return (
    <IntakeEmailLayout
      heading="NextChapter Talent"
      subheading={`${items.length} ${items.length === 1 ? 'reply' : 'replies'} waiting for your OK`}
      footerNote="Replies are never sent without your approval. You get this email only on days when replies are waiting."
    >
      <p>Hi {recruiterFirstName},</p>
      <p>These candidates have a drafted reply in your name. Approve them all in one click, or edit or cancel any.</p>
      <ul>
        {items.slice(0, 15).map((item, i) => (
          <li key={i}>
            <strong>{item.candidateName}</strong> — {item.kind}. {item.reason}
          </li>
        ))}
      </ul>
      {items.length > 15 && <p>And {items.length - 15} more.</p>}
      {!sendingEnabled && (
        <p style={{ fontSize: '14px', color: '#4a5568' }}>
          Sending is switched off until NextChapter finishes its legal review. Your approvals are saved and go out
          once it is on.
        </p>
      )}
      <p>
        <a href={reviewUrl} style={intakeButton}>
          Review and approve
        </a>
      </p>
    </IntakeEmailLayout>
  )
}

export function RecruiterFirmInviteEmail({
  firmName,
  inviterName,
  signupUrl,
}: {
  firmName: string
  inviterName: string
  signupUrl: string
}) {
  return (
    <IntakeEmailLayout heading="NextChapter Talent" footerNote={`${inviterName} invited you to ${firmName} on NextChapter.`}>
      <p>Hi,</p>
      <p>
        {inviterName} invited you to join {firmName} on NextChapter Talent. You get a personal page and forwarding
        address, so every candidate you can&apos;t place still gets an answer and a next step, and you hear when they
        land.
      </p>
      <p>Setup takes about 10 minutes.</p>
      <p>
        <a href={signupUrl} style={intakeButton}>
          Join {firmName}
        </a>
      </p>
    </IntakeEmailLayout>
  )
}
