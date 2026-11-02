import { Button, Card, CardEmail, Headline, Lead, MUTED, Small, Wordmark } from '@/lib/email/card-layout'

interface JobSavedEmailProps {
  title: string
  company: string
  jobUrl: string
  fitUrl: string
  unsubscribeUrl: string
}

/** Sent once when someone saves a public job page with their email. */
export default function JobSavedEmail({ title, company, jobUrl, fitUrl, unsubscribeUrl }: JobSavedEmailProps) {
  return (
    <CardEmail
      preheader={`Saved: ${title} at ${company}`}
      audience="candidate"
      footer={<a href={unsubscribeUrl} style={{ color: MUTED }}>Unsubscribe</a>}
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>
          Saved: {title} at {company}
        </Headline>
        <Lead>
          <a href={jobUrl}>Open the job again</a> any time while it is listed.
        </Lead>
        <Lead>
          Want to know how well you fit? Add your résumé and every job comes back ranked for you, with a fit score and the reason. It is free and takes
          about five minutes.
        </Lead>
        <Button href={fitUrl}>See how I fit</Button>
        <Small>
          You saved this job at launchyournextchapter.com. If you do not make a profile we will send up to two short reminders, then stop.
        </Small>
      </Card>
    </CardEmail>
  )
}
