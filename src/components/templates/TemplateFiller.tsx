'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { fillTemplate, type Template } from '@/lib/templates/library'
import { posthog } from '@/lib/posthog/client'

const FIELD = 'mt-1 w-full rounded-lg border border-border bg-white p-3 text-base'
const LABEL = 'block text-sm font-medium text-navy'

// Fill-in-the-blanks editor for one template: the preview rewrites itself as you type, and the text can be copied or
// opened in your own email app. Nothing is sent to us or stored.
export function TemplateFiller({ template }: { template: Template }) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState<'text' | 'subject' | null>(null)
  const started = useRef(false)

  useEffect(() => {
    posthog.capture('template_viewed', { slug: template.slug, category: template.category })
  }, [template.slug, template.category])

  const subject = template.subject ? fillTemplate(template.subject, template.fields, values) : ''
  const body = fillTemplate(template.body, template.fields, values)
  const whole = subject ? `Subject: ${subject}\n\n${body}` : body
  const filled = template.fields.filter((f) => (values[f.id] ?? '').trim()).length

  const edit = (id: string, v: string) => {
    if (!started.current) {
      started.current = true
      posthog.capture('template_started', { slug: template.slug, category: template.category })
    }
    setValues((x) => ({ ...x, [id]: v }))
  }

  async function copy(what: 'text' | 'subject') {
    try {
      await navigator.clipboard.writeText(what === 'text' ? whole : subject)
      setCopied(what)
      setTimeout(() => setCopied(null), 2000)
      posthog.capture('template_copied', { slug: template.slug, category: template.category, part: what, fieldsFilled: filled, fieldsTotal: template.fields.length })
    } catch {
      setCopied(null)
    }
  }

  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <form onSubmit={(e) => e.preventDefault()} className="space-y-4 rounded-xl border border-border bg-white p-6" aria-label={`Fill in the ${template.name} template`}>
        {template.fields.map((f) => (
          <label key={f.id} className={LABEL}>
            {f.label}
            {f.long ? (
              <textarea className={FIELD} rows={3} value={values[f.id] ?? ''} placeholder={f.placeholder} onChange={(e) => edit(f.id, e.target.value)} />
            ) : (
              <input className={FIELD} value={values[f.id] ?? ''} placeholder={f.placeholder} onChange={(e) => edit(f.id, e.target.value)} />
            )}
          </label>
        ))}
        <p className="text-xs text-muted-foreground">Nothing you type leaves your browser.</p>
      </form>

      <section className="rounded-xl border border-border bg-white p-6 lg:sticky lg:top-6 lg:self-start" aria-label="Your draft">
        {subject && (
          <p className="text-sm text-navy"><span className="text-muted-foreground">Subject: </span><span className="font-medium">{subject}</span></p>
        )}
        <pre className="mt-3 max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-lg bg-off-white p-4 font-sans text-sm leading-relaxed text-navy" aria-live="polite">{body}</pre>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" className="h-11 rounded-full bg-action px-6 text-action-foreground hover:brightness-95" onClick={() => copy('text')}>
            {copied === 'text' ? 'Copied' : 'Copy the text'}
          </Button>
          {subject && (
            <Button type="button" variant="outline" className="h-11 rounded-full px-5" onClick={() => copy('subject')}>
              {copied === 'subject' ? 'Copied' : 'Copy the subject'}
            </Button>
          )}
          {subject && (
            <a
              href={mailto}
              onClick={() => posthog.capture('template_email_opened', { slug: template.slug, category: template.category, fieldsFilled: filled })}
              className="inline-flex h-11 items-center rounded-full border border-border px-5 text-sm font-medium text-navy hover:bg-off-white"
            >
              Open in my email app
            </a>
          )}
        </div>
      </section>
    </div>
  )
}
