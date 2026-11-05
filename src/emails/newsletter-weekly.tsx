import type { LayoffWeekBrief } from '@/lib/newsletter/layoff-week'
import type { JourneyWeekBrief } from '@/lib/newsletter/journey-week'
import { emailCtaLabel } from '@/lib/ab/email-cta'
import type { NavCtaVariant } from '@/lib/ab/nav-cta'
import { Button, Card, CardEmail, Headline, Lead, MUTED, Wordmark } from '@/lib/email/card-layout'

interface NewsletterWeeklyEmailProps {
  introCopy: string | null
  articleTitle: string
  articleUrl: string
  articleSummary: string | null
  newsUrl: string
  signupUrl: string
  unsubscribeUrl: string
  /** The last seven days of WARN layoff notices, when there were enough to be worth a block. */
  layoffs?: LayoffWeekBrief | null
  layoffsUrl?: string
  /** Stories that went live in the last seven days, under the journey page each belongs to. Left out when there are none. */
  journeys?: JourneyWeekBrief | null
  /** The recipient's arm of the assessment button label test. */
  ctaVariant?: NavCtaVariant
}

/**
 * The Tuesday email for people who signed up on the site without an
 * account: the same article the candidate digest carries, without the
 * personal market numbers that need a profile to compute.
 */
export default function NewsletterWeeklyEmail({
  introCopy, articleTitle, articleUrl, articleSummary, newsUrl, signupUrl, unsubscribeUrl, layoffs, layoffsUrl, journeys, ctaVariant,
}: NewsletterWeeklyEmailProps) {
  const intro = introCopy || "Here's this week's read on the job market."
  return (
    <CardEmail
      preheader={articleTitle}
      audience="candidate"
      footer={
        <>
          You signed up for this email at launchyournextchapter.com.
          <br />
          <a href={unsubscribeUrl} style={{ color: MUTED }}>Unsubscribe</a>
        </>
      }
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>{intro}</Headline>
        <Lead>
          <strong>Worth a read:</strong> <a href={articleUrl}>{articleTitle}</a>
          {articleSummary && ` — ${articleSummary}`}
        </Lead>
        {layoffs && layoffsUrl && (
          <>
            <Lead>
              <strong>Layoffs this week:</strong> {layoffs.notices.toLocaleString('en-US')} layoff notices in {layoffs.states.toLocaleString('en-US')} {layoffs.states === 1 ? 'state' : 'states'}
              {layoffs.workers > 0 ? `, naming ${layoffs.workers.toLocaleString('en-US')} workers` : ''}. The largest:
            </Lead>
            <ul style={{ textAlign: 'left', margin: '0 0 16px', paddingLeft: 20 }}>
              {layoffs.top.map((e) => (
                <li key={e.name}>
                  {e.name}
                  {e.state ? `, ${e.state}` : ''}
                  {e.workers > 0 ? `: ${e.workers.toLocaleString('en-US')} workers` : ''}
                </li>
              ))}
            </ul>
            <Lead>
              <a href={layoffsUrl}>Every notice from the past week</a>. Know someone affected? Forward them this email: the page lists what to do and by when.
            </Lead>
          </>
        )}
        {journeys && journeys.length > 0 && (
          <>
            <Lead>
              <strong>At work this week:</strong> new stories on your rights, benefits, pay and side income.
            </Lead>
            {journeys.map((g) => (
              <div key={g.slug} style={{ textAlign: 'left', margin: '0 0 12px' }}>
                <a href={g.url} style={{ fontWeight: 600 }}>{g.label}</a>
                <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
                  {g.stories.map((s) => (
                    <li key={s.url}>
                      <a href={s.url}>{s.title}</a>
                      {s.source ? ` (${s.source})` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </>
        )}
        <Lead>
          More articles, videos and posts are on the <a href={newsUrl}>News page</a>.
        </Lead>
        <Lead>
          Searching for a job yourself? NextChapter is free for Members: a Market Reality Assessment, a resume tested against the systems
          that read it, and a plan for the week.
        </Lead>
        <Button campaign="newsletter_weekly" href={signupUrl} ctaVariant={ctaVariant}>{emailCtaLabel(ctaVariant, 'Get your Market Reality Assessment')}</Button>
      </Card>
    </CardEmail>
  )
}
