import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { buildLayoffWeekBrief } from '@/lib/newsletter/layoff-week'
import NewsletterWeeklyEmail from '@/emails/newsletter-weekly'
import type { PublicNotice } from '@/lib/warn/layoff-pages'

const NOW = Date.UTC(2026, 10, 2, 12)
const notice = (slug: string, employer: string, state: string, workers: number | null, daysAgo: number, known = true) =>
  ({ id: `${slug}-${daysAgo}`, slug, employer, state, workers, noticeDate: new Date(NOW - daysAgo * 86_400_000), noticeDateKnown: known }) as PublicNotice

describe('layoffs this week newsletter block', () => {
  it('is left out when the week is too quiet', () => {
    expect(buildLayoffWeekBrief([notice('a', 'A', 'CA', 10, 1), notice('b', 'B', 'CA', 10, 2)], NOW)).toBeNull()
  })
  it('counts only the last seven days and notices with a known date, and ranks employers by workers', () => {
    const brief = buildLayoffWeekBrief(
      [
        notice('big', 'Big Co', 'TX', 500, 1),
        notice('mid', 'Mid Co', 'CA', 120, 3),
        notice('mid', 'Mid Co', 'CA', 30, 4),
        notice('small', 'Small Co', 'CA', null, 6),
        notice('old', 'Old Co', 'NY', 900, 9),
        notice('unknown', 'Unknown Date', 'NY', 900, 1, false),
      ],
      NOW,
    )
    expect(brief).not.toBeNull()
    expect(brief!.notices).toBe(4)
    expect(brief!.workers).toBe(650)
    expect(brief!.states).toBe(2)
    expect(brief!.top.map((e) => e.name)).toEqual(['Big Co', 'Mid Co', 'Small Co'])
    expect(brief!.top[1].workers).toBe(150)
  })
  it('renders the block in the email only when there is one', () => {
    const base = { introCopy: null, articleTitle: 'T', articleUrl: 'https://x.test/a', articleSummary: null, newsUrl: 'https://x.test/news', signupUrl: 'https://x.test/s', unsubscribeUrl: 'https://x.test/u' }
    const brief = { notices: 12, workers: 3400, states: 5, top: [{ name: 'Big Co', workers: 900, state: 'Texas' }] }
    const withBlock = renderToStaticMarkup(NewsletterWeeklyEmail({ ...base, layoffs: brief, layoffsUrl: 'https://x.test/layoffs/this-week' }))
    expect(withBlock).toContain('12 layoff notices')
    expect(withBlock).toContain('Big Co')
    expect(withBlock).toContain('https://x.test/layoffs/this-week')
    expect(renderToStaticMarkup(NewsletterWeeklyEmail({ ...base, layoffs: null }))).not.toContain('layoff notices')
  })
})
