import { describe, expect, it, vi } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

const send = vi.fn(async (_payload: Record<string, unknown>, _options?: unknown) => ({ data: { id: 'real' }, error: null, headers: null }))
vi.mock('resend', () => ({
  Resend: class {
    emails = { send }
  },
}))

import { createResend } from '@/lib/email/resend-client'
import { hasAudienceTag, withAudienceHtml, withAudienceText, audienceLabel } from '@/lib/email/audience-tag'

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
    expect(send.mock.calls[0][0]).toEqual(payload)
  })

  it('warns on an untagged string email so a new sender cannot ship unmarked', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await createResend('k').emails.send({ from: 'a@b.com', to: 'real@gmail.com', subject: 'Untagged one', html: '<p>x</p>' })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Untagged one'))
    warn.mockRestore()
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
