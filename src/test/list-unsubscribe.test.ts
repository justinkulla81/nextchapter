import { describe, expect, it } from 'vitest'
import { findUnsubscribeUrl, oneClickUrl, withOneClickUnsubscribe } from '@/lib/email/list-unsubscribe'

const APP = 'https://launchyournextchapter.com'
const POST = { 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }

describe('oneClickUrl', () => {
  it('keeps the unsubscribe links whose POST opts out', () => {
    for (const p of ['/api/unsubscribe/lead/tok', '/api/unsubscribe/intake/tok', '/api/unsubscribe/newsletter/tok', '/api/unsubscribe/audience/coach/c1?sig=x',
      '/api/unsubscribe/cand1?type=weekly&sig=abc', '/api/mailing/unsubscribe/tok', '/api/higher-ed/unsubscribe/tok']) {
      expect(oneClickUrl(APP + p)).toBe(APP + p)
    }
  })
  it('maps the list-email page to its one-click twin', () => {
    expect(oneClickUrl(`${APP}/updates/unsubscribe/abc.def`)).toBe(`${APP}/api/mailing/unsubscribe/abc.def`)
  })
  it('decodes &amp; from HTML and refuses "send me fewer" and other pages', () => {
    expect(oneClickUrl(`${APP}/api/unsubscribe/c1?type=weekly&amp;sig=s`)).toBe(`${APP}/api/unsubscribe/c1?type=weekly&sig=s`)
    expect(oneClickUrl(`${APP}/api/unsubscribe/c1?type=weekly&sig=s&fewer=1`)).toBeNull()
    expect(oneClickUrl(`${APP}/dashboard/privacy`)).toBeNull()
    expect(oneClickUrl('mailto:a@b.com')).toBeNull()
  })
})

describe('withOneClickUnsubscribe', () => {
  const html = `<a href="${APP}/jobs/1">Job</a> <a href="${APP}/api/unsubscribe/c1?type=weekly&amp;sig=s">Unsubscribe</a>`
  it('adds both headers from the link in the body', () => {
    expect(withOneClickUnsubscribe(undefined, html)).toEqual({ 'List-Unsubscribe': `<${APP}/api/unsubscribe/c1?type=weekly&sig=s>`, ...POST })
    expect(findUnsubscribeUrl(`Unsubscribe ${APP}/api/unsubscribe/lead/t1\n`)).toBe(`${APP}/api/unsubscribe/lead/t1`)
  })
  it('adds the Post header to a sender’s own header and maps the page link', () => {
    expect(withOneClickUnsubscribe({ 'List-Unsubscribe': `<${APP}/updates/unsubscribe/t>` }, null))
      .toEqual({ 'List-Unsubscribe': `<${APP}/api/mailing/unsubscribe/t>`, ...POST })
    expect(withOneClickUnsubscribe({ 'List-Unsubscribe': `<mailto:x@y.com?subject=unsubscribe>, <${APP}/api/unsubscribe/lead/t>` }, null))
      .toEqual({ 'List-Unsubscribe': `<mailto:x@y.com?subject=unsubscribe>, <${APP}/api/unsubscribe/lead/t>`, ...POST })
  })
  it('leaves an email alone when it already has one-click or has no unsubscribe link', () => {
    const done = { 'List-Unsubscribe': '<x>', ...POST }
    expect(withOneClickUnsubscribe(done, html)).toBe(done)
    expect(withOneClickUnsubscribe(undefined, `<a href="${APP}/jobs/1">Job</a>`)).toBeUndefined()
    const h = { 'X-NextChapter-Audience': 'candidate' }
    expect(withOneClickUnsubscribe(h, 'no links')).toBe(h)
  })
})
