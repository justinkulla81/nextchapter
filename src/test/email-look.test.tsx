import { describe, expect, it } from 'vitest'
import { render } from '@react-email/render'
import MidweekCheckinEmail from '@/emails/midweek-checkin'
import NewsletterWeeklyEmail from '@/emails/newsletter-weekly'
import WeeklyGapNudgeEmail from '@/emails/weekly-gap-nudge'
import { checkinNoteText, nudgeNoteText } from '@/lib/email/margin-note-text'

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

  it('puts the points in a box with a handwritten aside on the check-in and the nudge', async () => {
    const note = { src: 'https://x.test/hw.png', text: 'past the halfway mark' }
    const mid = await render(
      <MidweekCheckinEmail firstName="Sam" victoriaName="Vic" introCopy={null} isReset={false} bullets={['One thing']} weeklyRecap={null} gap={{ weeklyPoints: 32, weeklyPointsTarget: 50, pointsToGo: 18 }} marginNote={note} appUrl="https://x.test" unsubscribeUrl="https://x.test/u" />,
    )
    expect(mid).toContain('32 of 50')
    expect(mid).toContain('alt="past the halfway mark"')
    expect(mid).toContain('Midweek check-in')
    const nudge = await render(<WeeklyGapNudgeEmail firstName="Sam" weeklyPoints={32} weeklyPointsTarget={50} dashboardUrl="https://x.test/d" unsubscribeUrl="https://x.test/u" marginNote={note} />)
    expect(nudge).toContain('points from an A this week')
    expect(nudge).toContain('alt="past the halfway mark"')
    expect(nudge).toContain('/email/signature-victoria.png')
  })

  it('writes margin notes that only read the numbers', () => {
    expect(checkinNoteText(32, 50)).toBe('past the halfway mark')
    expect(checkinNoteText(50, 50)).toBe('you hit the mark this week')
    expect(checkinNoteText(0, 50)).toBe('one small thing is enough')
    expect(nudgeNoteText(5, 50)).toBe('a small gap, easy to close')
    expect(nudgeNoteText(0, 50)).toBe('nothing left to close')
  })
})
