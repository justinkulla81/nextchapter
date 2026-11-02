import { Button, Card, CardEmail, Headline, INK, Lead, MUTED, Wordmark } from '@/lib/email/card-layout'

export interface JobAlertEmailJob {
  title: string
  company: string
  location: string | null
  /** The tracked link: counts the click, then opens the job. */
  href: string
}

interface JobAlertDigestEmailProps {
  searchLabel: string
  jobs: JobAlertEmailJob[]
  /** Lead-gen: the next step for the journey we guessed, pre-selected. */
  startUrl: string
  startLabel: string
  unsubscribeUrl: string
}

/** The daily job alert: up to five new jobs for the saved search(es), then one next step. */
export default function JobAlertDigestEmail({ searchLabel, jobs, startUrl, startLabel, unsubscribeUrl }: JobAlertDigestEmailProps) {
  const headline = `${jobs.length} new ${jobs.length === 1 ? 'job' : 'jobs'} for ${searchLabel}`
  return (
    <CardEmail
      audience="candidate"
      preheader={headline}
      footer={
        <>
          You get this because you saved a job search at launchyournextchapter.com. At most one email a day.{' '}
          <a href={unsubscribeUrl} style={{ color: MUTED }}>
            Unsubscribe
          </a>
        </>
      }
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>{headline}</Headline>
        <div style={{ textAlign: 'left', margin: '0 0 28px' }}>
          {jobs.map((j) => (
            <p key={j.href} style={{ margin: '0 0 14px', fontSize: '16px', lineHeight: '1.5', color: MUTED }}>
              <a href={j.href} style={{ fontWeight: 600, color: INK }}>
                {j.title}
              </a>
              <br />
              {j.company}
              {j.location ? ` · ${j.location}` : ''}
            </p>
          ))}
        </div>
        <Lead>
          These are in the order posted, with no ranking. Add your résumé and the same jobs come back ranked for you, with a fit score and the reason. Free, about five minutes.
        </Lead>
        <Button href={startUrl}>{startLabel}</Button>
      </Card>
    </CardEmail>
  )
}
