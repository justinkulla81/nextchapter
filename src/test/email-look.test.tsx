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

  it('opens the newsletter with a chapter masthead and signs it as Victoria', async () => {
    const html = await render(
      <NewsletterWeeklyEmail introCopy={null} articleTitle="A read" articleUrl="https://x.test/a" articleSummary={null} newsUrl="https://x.test/n" signupUrl="https://x.test/s" unsubscribeUrl="https://x.test/u" />,
    )
    expect(html).toContain('/email/signature-victoria.png')
    expect(html).toMatch(/Chapter \d+/)
    expect(html).toContain('/email/squiggle.png')
  })

  it('draws the handwritten aside only when it has an image', async () => {
    const base = { introCopy: null, articleTitle: 'A read', articleUrl: 'https://x.test/a', articleSummary: null, newsUrl: 'https://x.test/n', signupUrl: 'https://x.test/s', unsubscribeUrl: 'https://x.test/u' }
    const withNote = await render(<NewsletterWeeklyEmail {...base} marginNote={{ src: 'https://x.test/hw.png', text: 'biggest cut: Acme' }} />)
    expect(withNote).toContain('alt="biggest cut: Acme"')
    const without = await render(<NewsletterWeeklyEmail {...base} marginNote={{ src: null, text: 'biggest cut: Acme' }} />)
    expect(without).not.toContain('biggest cut')
  })
})
