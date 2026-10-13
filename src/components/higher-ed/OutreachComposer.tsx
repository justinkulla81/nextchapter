'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { saveOutreachDraft, sendOutreachTest } from '@/app/i/[slug]/(portal)/outreach-actions'

type Field = { key: string; label: string }

const fill = (t: string, v: Record<string, string>) => t.replace(/\{\{(\w+)\}\}/g, (_, k: string) => v[k] ?? `{{${k}}}`)

// Write, preview, test. Sending to alumni happens from the list below,
// one confirmed batch at a time.
export function OutreachComposer(props: {
  slug: string
  base: string
  college: string
  draft: { id: string; subject: string; body: string; audience: string } | null
  audiences: { key: string; label: string; count: number }[]
  fields: readonly Field[]
  sample: Record<string, string>
}) {
  const [id, setId] = useState(props.draft?.id ?? null)
  const [subject, setSubject] = useState(props.draft?.subject ?? '')
  const [body, setBody] = useState(props.draft?.body ?? `Hi {{firstName}},\n\n\n\nStart here: {{link}}\n\n${props.college} Alumni Relations`)
  const [audience, setAudience] = useState(props.draft?.audience ?? 'all')
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null)
  const [sent, setSent] = useState<{ subject: string; text: string } | null>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const known = new Set(props.fields.map((f) => f.key))
  const unknown = [...new Set([...`${subject} ${body}`.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).filter((k) => !known.has(k)))]

  const insert = (key: string) => {
    const el = bodyRef.current
    const token = `{{${key}}}`
    if (!el) return setBody((b) => b + token)
    const [a, z] = [el.selectionStart, el.selectionEnd]
    setBody((b) => b.slice(0, a) + token + b.slice(z))
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(a + token.length, a + token.length)
    })
  }
  const save = async () => {
    const r = await saveOutreachDraft(props.slug, { id, subject, body, audience })
    if (r.error) {
      setMsg({ text: r.error, error: true })
      return null
    }
    setId(r.id!)
    return r.id!
  }

  return (
    <div className={cn('grid gap-6 lg:grid-cols-2', pending && 'cursor-wait')}>
      <div className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Who it goes to</legend>
          <div className="flex flex-wrap gap-2">
            {props.audiences.map((a) => (
              <Button key={a.key} type="button" size="sm" variant={audience === a.key ? 'default' : 'outline'} aria-pressed={audience === a.key} onClick={() => setAudience(a.key)}>
                {a.label} ({a.count.toLocaleString()})
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Never includes do-not-contact or opted-out alumni.</p>
        </fieldset>
        <div className="space-y-1.5">
          <Label htmlFor="composer-subject">Subject</Label>
          <Input id="composer-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="A short, specific subject" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="composer-body">Email</Label>
          <textarea id="composer-body" ref={bodyRef} value={body} onChange={(e) => setBody(e.target.value)} className="min-h-56 w-full rounded-md border border-input bg-background p-3 font-mono text-sm" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Insert:</span>
            {props.fields.map((f) => (
              <Button key={f.key} type="button" size="sm" variant="outline" onClick={() => insert(f.key)} title={f.label}>
                {f.label}
              </Button>
            ))}
          </div>
          {unknown.length > 0 && (
            <p role="alert" className="text-sm text-destructive">
              {unknown.map((u) => `{{${u}}}`).join(', ')} {unknown.length === 1 ? 'isn’t a merge field' : 'aren’t merge fields'} and would send blank. Use the buttons above.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                setMsg(null)
                if (await save()) setMsg({ text: 'Saved. Send it from the list below when it’s ready.', error: false })
              })
            }
          >
            {pending ? 'Saving…' : id ? 'Save changes' : 'Save draft'}
          </Button>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setMsg(null)
                const savedId = await save()
                if (!savedId) return
                const r = await sendOutreachTest(props.slug, savedId)
                if (r.error) setMsg({ text: r.error, error: true })
                else {
                  setMsg({ text: r.message ?? 'Sent.', error: false })
                  setSent(r.preview ?? null)
                }
              })
            }
          >
            Send a test to me
          </Button>
          {id && (
            <Link href={`${props.base}/outreach`} className="text-sm text-muted-foreground hover:underline">
              Start a new email
            </Link>
          )}
        </div>
        {msg && (
          <p role={msg.error ? 'alert' : 'status'} className={cn('text-sm', msg.error ? 'text-destructive' : 'text-muted-foreground')}>
            {msg.text}
          </p>
        )}
      </div>
      <section aria-label="Preview" className="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
        <p className="text-xs font-medium text-muted-foreground">{sent ? 'The test as sent' : 'Preview for Jordan'}</p>
        <p className="font-medium">{sent?.subject ?? (fill(subject, props.sample) || 'No subject yet')}</p>
        <pre className="font-sans text-sm whitespace-pre-wrap">{sent?.text ?? fill(body, props.sample)}</pre>
      </section>
    </div>
  )
}
