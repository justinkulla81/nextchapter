import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

const send = vi.fn(async (_payload: Record<string, unknown>, _options?: unknown) => ({ data: { id: 'real' }, error: null, headers: null }))
vi.mock('resend', () => ({
  Resend: class {
    emails = { send }
  },
}))

import { createResend } from '@/lib/email/resend-client'
import { hasAudienceTag, withAudienceHtml, withAudienceText, audienceLabel, audienceFromContent, AudienceTag } from '@/lib/email/audience-tag'
import { IntakeEmailLayout } from '@/emails/intake-email-layout'

describe('audience tag helpers', () => {
  it('appends a small labelled line to html, before </body> when present', () => {
    expect(withAudienceHtml('coach', '<p>Hi</p>')).toMatch(/<p>Hi<\/p><p style="[^"]*">NextChapter · Coach<\/p>$/)
    expect(withAudienceHtml('admin', '<body><p>Hi</p></body>')).toMatch(/NextChapter · Internal<\/p><\/body>$/)
  })

  it('appends a signature-style line to plain text', () => {
    expect(withAudienceText('recruiter', 'Hello\n')).toBe('Hello\n\n—\nNextChapter · Recruiter\n')
  })

  it('never doubles up', () => {
    const once = withAudienceHtml('candidate', '<p>x</p>')
    expect(withAudienceHtml('candidate', once)).toBe(once)
    const text = withAudienceText('candidate', 'x')
    expect(withAudienceText('candidate', text)).toBe(text)
  })

  it('recognises its own marker and nothing else', () => {
    expect(hasAudienceTag('NextChapter · Employer')).toBe(true)
    expect(hasAudienceTag('Sent by NextChapter')).toBe(false)
  })

  it('has a label for every audience', () => {
    for (const a of ['candidate', 'coach', 'recruiter', 'employer', 'organization', 'supporter', 'admin', 'general'] as const) {
      expect(audienceLabel(a)).toBeTruthy()
    }
  })
})

describe('createResend with an audience', () => {
  it('tags html and text sends', async () => {
    send.mockClear()
    await createResend('k', 'coach').emails.send({ from: 'a@b.com', to: 'real@gmail.com', subject: 's', html: '<p>x</p>', text: 'x' })
    const sent = send.mock.calls[0][0] as { html: string; text: string }
    expect(sent.html).toContain('NextChapter · Coach')
    expect(sent.text).toContain('NextChapter · Coach')
  })

  it('leaves react-template sends alone (the template carries its own tag)', async () => {
    send.mockClear()
    const payload = { from: 'a@b.com', to: 'real@gmail.com', subject: 's', react: null }
    await createResend('k', 'coach').emails.send(payload as never)
    // The body is untouched; only the audience header is added.
    expect(send.mock.calls[0][0]).toEqual({ ...payload, headers: { 'X-NextChapter-Audience': 'coach' } })
  })

  it('warns on an untagged string email so a new sender cannot ship unmarked', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await createResend('k').emails.send({ from: 'a@b.com', to: 'real@gmail.com', subject: 'Untagged one', html: '<p>x</p>' })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Untagged one'))
    warn.mockRestore()
  })
})

describe('X-NextChapter-Audience header', () => {
  const headerOf = () => (send.mock.calls.at(-1)![0] as { headers?: Record<string, string> }).headers?.['X-NextChapter-Audience']

  it('comes from the audience argument for string emails', async () => {
    await createResend('k', 'admin').emails.send({ from: 'a@b.com', to: 'real@gmail.com', subject: 's', html: '<p>x</p>' })
    expect(headerOf()).toBe('admin')
  })

  it("comes from a React template's own AudienceTag, nested anywhere in it", async () => {
    const react = createElement('div', null, createElement('p', null, 'hi'), [createElement(AudienceTag, { audience: 'recruiter' })])
    await createResend('k').emails.send({ from: 'a@b.com', to: 'real@gmail.com', subject: 's', react })
    expect(headerOf()).toBe('recruiter')
  })

  it('reads the intake layout, defaulting to candidate', async () => {
    const mk = (audience?: 'recruiter') => createElement(IntakeEmailLayout, { heading: 'h', footerNote: 'f', audience, children: 'body' })
    await createResend('k').emails.send({ from: 'a@b.com', to: 'real@gmail.com', subject: 's', react: mk() })
    expect(headerOf()).toBe('candidate')
    await createResend('k').emails.send({ from: 'a@b.com', to: 'real@gmail.com', subject: 's', react: mk('recruiter') })
    expect(headerOf()).toBe('recruiter')
  })

  it('reads a tag already inside a string body, and keeps other headers', async () => {
    await createResend('k').emails.send({
      from: 'a@b.com', to: 'real@gmail.com', subject: 's', html: withAudienceHtml('general', '<p>x</p>'), headers: { 'List-Unsubscribe': '<x>' },
    })
    const h = (send.mock.calls.at(-1)![0] as { headers: Record<string, string> }).headers
    expect(h['X-NextChapter-Audience']).toBe('general')
    expect(h['List-Unsubscribe']).toBe('<x>')
  })

  it('warns when a React template renders no tag, and sets no header', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await createResend('k').emails.send({ from: 'a@b.com', to: 'real@gmail.com', subject: 'No tag here', react: createElement('div', null, 'x') })
    expect(headerOf()).toBeUndefined()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('No tag here'))
    warn.mockRestore()
  })

  it('parses the audience back out of content', () => {
    expect(audienceFromContent(withAudienceText('supporter', 'x'))).toBe('supporter')
    expect(audienceFromContent('nothing')).toBeNull()
  })
})

describe('every email template carries an audience tag', () => {
  const dir = join(process.cwd(), 'src', 'emails')
  // Partials that are included in other templates, or whose layout tags for them.
  const EXEMPT = new Set(['engagement-block.tsx', 'intake-emails.tsx'])
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.tsx') && !EXEMPT.has(f))) {
    it(file, () => {
      const src = readFileSync(join(dir, file), 'utf8')
      expect(src, `${file} must render <AudienceTag audience="…" />`).toMatch(/AudienceTag/)
    })
  }
  it('intake emails go through the layout, which tags them', () => {
    expect(readFileSync(join(dir, 'intake-emails.tsx'), 'utf8')).not.toMatch(/<div style/)
    expect(readFileSync(join(dir, 'intake-email-layout.tsx'), 'utf8')).toMatch(/AudienceTag/)
  })
})
