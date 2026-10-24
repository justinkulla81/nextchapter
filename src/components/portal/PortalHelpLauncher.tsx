'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { MessageSquare, X } from 'lucide-react'
import { usePostHog } from '@/lib/posthog/client'
import { submitPortalHelp, type PortalHelpState } from '@/app/portal-help/actions'
import { HELP_FORM_KINDS, isConversationKind, mentionsCrisis, type HelpFormKind, type PortalHelpPortal } from '@/lib/help/constants'

/**
 * "Help & feedback" for the partner portals (employer, recruiter, coach,
 * institution): the corner button and panel the candidate portal has, sending
 * into the same admin Help inbox. Replies come back by email, since these
 * users have no in-app inbox. Mount once in each portal's authenticated layout.
 */
export function PortalHelpLauncher({ portal, slug = null }: { portal: PortalHelpPortal; slug?: string | null }) {
  const pathname = usePathname() ?? '/'
  const posthog = usePostHog()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<HelpFormKind>('help')
  const [text, setText] = useState('')
  const [formKey, setFormKey] = useState(0)
  const [state, action, pending] = useActionState<PortalHelpState, FormData>(submitPortalHelp.bind(null, portal, slug), undefined)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    panelRef.current?.querySelector<HTMLElement>('button[aria-pressed="true"]')?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function openPanel() {
    const heading = document.querySelector('main h1')?.textContent?.trim()
    setTitle(heading || document.title)
    setOpen(true)
    posthog?.capture('help_launcher_opened', { page: pathname, portal })
  }
  function close() {
    setOpen(false)
    buttonRef.current?.focus()
  }
  function reset() {
    setText('')
    setKind('help')
    setFormKey((k) => k + 1)
    close()
  }

  const current = HELP_FORM_KINDS.find((k) => k.value === kind)!
  const crisis = mentionsCrisis(text)

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={openPanel}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30 inline-flex items-center gap-2 rounded-full bg-navy px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand lg:right-6 lg:bottom-6"
      >
        <MessageSquare className="size-4" aria-hidden />
        <span>Help &amp; feedback</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end sm:p-6" role="presentation">
          <button type="button" aria-label="Close Help and feedback" onClick={close} className="absolute inset-0 bg-black/20" />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="portal-help-title"
            className="relative flex h-full w-full flex-col overflow-y-auto bg-white p-5 shadow-2xl sm:h-auto sm:max-h-[calc(100vh-3rem)] sm:max-w-md sm:rounded-2xl"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 id="portal-help-title" className="text-lg font-semibold text-navy">How can we help?</h2>
              <button type="button" onClick={close} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close">
                <X className="size-5" aria-hidden />
              </button>
            </div>

            {state?.sent ? (
              <div role="status" className="space-y-3">
                <div className="rounded-lg border border-success/30 bg-success/5 p-4 text-sm">
                  {state.kind && isConversationKind(state.kind) ? (
                    <>
                      <p className="font-semibold text-navy">Sent. We’ll reply by email{state.email ? <> to {state.email}</> : null}.</p>
                      <p className="mt-1 text-muted-foreground">Most questions get an answer within one business day.</p>
                    </>
                  ) : (
                    <p className="font-semibold text-navy">Thank you. We read every one.</p>
                  )}
                </div>
                <button type="button" onClick={reset} className="text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground">Close</button>
              </div>
            ) : (
              <form key={formKey} action={action} className={pending ? 'cursor-wait' : undefined} noValidate>
                <input type="hidden" name="kind" value={kind} />
                <input type="hidden" name="contextPath" value={pathname} />
                <input type="hidden" name="contextTitle" value={title} />

                <div role="group" aria-label="What would you like to do?" className="grid grid-cols-2 gap-2">
                  {HELP_FORM_KINDS.map((k) => (
                    <button
                      key={k.value}
                      type="button"
                      aria-pressed={kind === k.value}
                      onClick={() => { setKind(k.value); posthog?.capture('help_kind_selected', { kind: k.value, page: pathname, portal }) }}
                      className={`rounded-lg border px-3 py-2 text-left text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                        kind === k.value ? 'border-brand bg-brand/5 text-navy ring-1 ring-brand' : 'border-border bg-white text-foreground hover:bg-muted'
                      }`}
                    >
                      {k.label}
                      <span className="block text-xs font-normal text-muted-foreground">{k.hint}</span>
                    </button>
                  ))}
                </div>

                <label htmlFor="portal-help-message" className="mt-4 block text-sm font-semibold text-navy">{current.prompt}</label>
                <textarea
                  id="portal-help-message"
                  name="message"
                  rows={5}
                  required
                  maxLength={5000}
                  placeholder={current.placeholder}
                  defaultValue={state?.message}
                  onChange={(e) => setText(e.target.value)}
                  className="mt-1 w-full resize-y rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20"
                />

                {crisis && (
                  <p role="note" className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-foreground">
                    If you’re going through something really hard right now, you can call or text <span className="font-semibold">988</span> any time,
                    free and confidential. Your message will still be sent.
                  </p>
                )}

                <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                  We’ll include the page you’re on{title ? <> ({title})</> : null}, your name and your account, so we can see what you saw and reply by email.
                </p>

                {state?.error && <p role="alert" className="mt-3 text-sm font-medium text-error">{state.error}</p>}

                <button
                  type="submit"
                  disabled={pending}
                  onClick={() => posthog?.capture('help_form_send_clicked', { kind, page: pathname, portal })}
                  className="mt-4 inline-flex items-center justify-center rounded-lg bg-action px-5 py-2.5 text-sm font-semibold text-action-foreground hover:brightness-95 disabled:cursor-wait disabled:opacity-70"
                >
                  {pending ? 'Sending…' : 'Send'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
