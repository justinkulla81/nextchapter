'use client'

import { useActionState, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { usePostHog } from 'posthog-js/react'
import { submitHelpForm, type HelpFormState } from '@/app/dashboard/help/actions'
import { HELP_FORM_KINDS, isConversationKind, mentionsCrisis, type HelpFormKind } from '@/lib/help/constants'

/**
 * The Help & feedback form, used in the corner panel on every portal page
 * and on /dashboard/help. Four choices as buttons (design principles: 2–4
 * options). The page the candidate is on travels with the message.
 */
export function HelpFeedbackForm({
  contextPath, contextTitle, initialKind = 'help', onDone,
}: {
  contextPath: string
  contextTitle: string
  initialKind?: HelpFormKind
  onDone?: () => void
}) {
  const posthog = usePostHog()
  const [kind, setKind] = useState<HelpFormKind>(initialKind)
  const [text, setText] = useState('')
  const [formKey, setFormKey] = useState(0)
  const [state, action, pending] = useActionState<HelpFormState, FormData>(submitHelpForm, undefined)
  const router = useRouter()
  const pathname = usePathname()
  // On /dashboard/help the lists below the form should show what was just
  // sent; elsewhere (the corner panel) nothing on the page depends on it.
  useEffect(() => {
    if (state?.sent && pathname?.startsWith('/dashboard/help')) router.refresh()
  }, [state, pathname, router])
  const current = HELP_FORM_KINDS.find((k) => k.value === kind)!
  const crisis = mentionsCrisis(text)

  if (state?.sent) {
    return (
      <div role="status" className="space-y-3">
        <div className="rounded-lg border border-success/30 bg-success/5 p-4 text-sm">
          {state.kind && isConversationKind(state.kind) ? (
            <>
              <p className="font-semibold text-navy">Sent. We’ll reply here and by email.</p>
              <p className="mt-1 text-muted-foreground">You’ll find the conversation on Help &amp; feedback.</p>
            </>
          ) : (
            <>
              <p className="font-semibold text-navy">Thank you. We read every one.</p>
              <p className="mt-1 text-muted-foreground">You can see what happens to it on Help &amp; feedback.</p>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <a href={state.requestId ? `/dashboard/help?request=${state.requestId}` : '/dashboard/help'} className="font-medium text-brand underline underline-offset-4">
            Open Help &amp; feedback
          </a>
          <button
            type="button"
            className="font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
            onClick={() => { setText(''); setFormKey((k) => k + 1); onDone?.() }}
          >
            {onDone ? 'Close' : 'Send another'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <form key={formKey} action={action} className={pending ? 'cursor-wait' : undefined} noValidate>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="contextPath" value={contextPath} />
      <input type="hidden" name="contextTitle" value={contextTitle} />

      <div role="group" aria-label="What would you like to do?" className="grid grid-cols-2 gap-2">
        {HELP_FORM_KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            aria-pressed={kind === k.value}
            onClick={() => { setKind(k.value); posthog?.capture('help_kind_selected', { kind: k.value, page: contextPath }) }}
            className={`rounded-lg border px-3 py-2 text-left text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              kind === k.value ? 'border-brand bg-brand/5 text-navy ring-1 ring-brand' : 'border-border bg-white text-foreground hover:bg-muted'
            }`}
          >
            {k.label}
            <span className="block text-xs font-normal text-muted-foreground">{k.hint}</span>
          </button>
        ))}
      </div>

      <label htmlFor="help-message" className="mt-4 block text-sm font-semibold text-navy">{current.prompt}</label>
      <textarea
        id="help-message"
        name="message"
        rows={5}
        required
        maxLength={5000}
        placeholder={current.placeholder}
        defaultValue={state?.message}
        onChange={(e) => setText(e.target.value)}
        className="mt-1 w-full resize-y rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20"
      />

      {kind === 'problem' && (
        <div className="mt-2">
          <label htmlFor="help-screenshot" className="text-sm font-medium text-navy">Screenshot <span className="font-normal text-muted-foreground">(optional, PNG or JPG, up to 5 MB)</span></label>
          <input id="help-screenshot" name="screenshot" type="file" accept="image/png,image/jpeg,image/webp" className="mt-1 block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium" />
        </div>
      )}

      {crisis && (
        <p role="note" className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-foreground">
          If you’re going through something really hard right now, you can call or text <span className="font-semibold">988</span> any time,
          free and confidential. <a href="/dashboard/support" className="text-brand underline underline-offset-4">More support options</a>. Your message will still be sent.
        </p>
      )}

      <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
        {isConversationKind(kind)
          ? <>We’ll include the page you’re on{contextTitle ? <> ({contextTitle})</> : null} and your browser, so we can see what you saw.</>
          : <>We’ll note the page you’re on{contextTitle ? <> ({contextTitle})</> : null}. Your name is attached so we can follow up.</>}
      </p>

      {state?.error && <p role="alert" className="mt-3 text-sm font-medium text-error">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        onClick={() => posthog?.capture('help_form_send_clicked', { kind, page: contextPath })}
        className="mt-4 inline-flex items-center justify-center rounded-lg bg-success px-5 py-2.5 text-sm font-semibold text-white hover:bg-success-hover disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? 'Sending…' : 'Send'}
      </button>
    </form>
  )
}
