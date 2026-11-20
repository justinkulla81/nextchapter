import { describe, expect, it } from 'vitest'
import { layoffReceiptText, newsReceiptText, replySubject } from '@/lib/inbox/receipt-text'

describe('inbox receipts', () => {
  it('replies on the same subject', () => {
    expect(replySubject('Big layoff at Acme')).toBe('Re: Big layoff at Acme')
    expect(replySubject('RE: already a reply')).toBe('RE: already a reply')
    expect(replySubject(null)).toBe('Received')
  })

  it('says where each news@ article went, without repeating "Sent to news@"', () => {
    const text = newsReceiptText(
      [
        { url: 'https://www.reuters.com/business/acme-cuts', title: 'Acme cuts 500 jobs', used: 'Sent to news@. Goes to: monthly report, website News. Strong data.' },
        { url: 'https://example.org/paywalled/story', title: null, used: 'Sent to news@, but the page could not be read (paywall or blocked). Read it and decide.' },
        { url: 'https://www.wsj.com/x', title: 'Old story', used: 'Sent to news@. Not used: off topic.', alreadyFiled: true },
      ],
      'articles',
    )
    expect(text).toContain('Received your email to news@.')
    expect(text).toContain('- Acme cuts 500 jobs\n  Goes to: monthly report, website News. Strong data.')
    expect(text).toContain('- example.org/paywalled/story\n  The page could not be read (paywall or blocked). Read it and decide.')
    expect(text).toContain('Already filed from an earlier email, nothing new added. Not used: off topic.')
    expect(text).toContain('https://launchyournextchapter.com/support/admin/digest')
    expect(text).not.toMatch(/Sent to news@\./)
  })

  it('explains a newsletter and an empty email', () => {
    expect(newsReceiptText([], 'newsletter')).toContain('send that story on its own')
    expect(newsReceiptText([], 'empty')).toContain('nothing was filed')
  })

  it('tells layoffs@ how the story is used', () => {
    const text = layoffReceiptText()
    expect(text).toContain('Received your email to layoffs@.')
    expect(text).toContain('public layoff tracker')
    expect(text).toContain('https://launchyournextchapter.com/support/admin/crm/warn')
  })
})
