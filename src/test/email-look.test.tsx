import { describe, expect, it } from 'vitest'
import { render } from '@react-email/render'
import MidweekCheckinEmail from '@/emails/midweek-checkin'
import NewsletterWeeklyEmail from '@/emails/newsletter-weekly'

// The shared card look: paper card, bookmark mark, and Victoria's handwritten sign-off.
describe('email look', () => {
  it('signs the midweek check-in with the name it was sent under', async () => {
    const html = await render(
      <MidweekCheckinEmail firstName="Sam" victoriaName="Vic" introCopy={null} isReset={false} bullets={null} weeklyRecap={null} appUrl="https://launchyournextchapter.com" unsubscribeUrl="https://x.test/u" />,
    )
    expect(html).toContain('/email/signature-vic.png')
    expect(html).toContain('/email/bookmark.png')
    expect(html).not.toContain('I&#x27;ll be here. —')
  })

  it('signs the newsletter as Victoria', async () => {
    const html = await render(
      <NewsletterWeeklyEmail introCopy={null} articleTitle="A read" articleUrl="https://x.test/a" articleSummary={null} newsUrl="https://x.test/n" signupUrl="https://x.test/s" unsubscribeUrl="https://x.test/u" />,
    )
    expect(html).toContain('/email/signature-victoria.png')
  })
})
