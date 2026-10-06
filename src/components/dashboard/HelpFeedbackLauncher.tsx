'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { MessageSquare, X } from 'lucide-react'
import { usePostHog } from 'posthog-js/react'
import { HelpFeedbackForm } from '@/components/dashboard/HelpFeedbackForm'

/**
 * The "Help & feedback" button in the corner of every portal page. Opens the
 * form in a panel (full screen on phones) so a problem can be reported on the
 * page where it happened. Not shown on /dashboard/help, which has the form.
 */
export function HelpFeedbackLauncher({ repliesWaiting = 0 }: { repliesWaiting?: number }) {
  const pathname = usePathname() ?? '/dashboard'
  const posthog = usePostHog()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    panelRef.current?.querySelector<HTMLElement>('button[aria-pressed="true"]')?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (pathname.startsWith('/dashboard/help')) return null

  function openPanel() {
    setTitle(document.title.replace(/\s*[|–—-]\s*NextChapter\s*$/i, '').trim())
    setOpen(true)
    posthog?.capture('help_launcher_opened', { page: pathname })
  }
  function close() {
    setOpen(false)
    buttonRef.current?.focus()
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={openPanel}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 inline-flex items-center gap-2 rounded-full bg-navy px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand lg:right-6 lg:bottom-6"
      >
        <MessageSquare className="size-4" aria-hidden />
        <span>Help &amp; feedback</span>
        {repliesWaiting > 0 && (
          <span className="rounded-full bg-orange px-1.5 text-xs font-bold text-navy" aria-label={`${repliesWaiting} ${repliesWaiting === 1 ? 'reply' : 'replies'} waiting`}>
            {repliesWaiting}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end sm:p-6" role="presentation">
          <button type="button" aria-label="Close Help and feedback" onClick={close} className="absolute inset-0 bg-black/20" />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-panel-title"
            className="relative flex h-full w-full flex-col overflow-y-auto bg-white p-5 shadow-2xl sm:h-auto sm:max-h-[calc(100vh-3rem)] sm:max-w-md sm:rounded-2xl"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 id="help-panel-title" className="text-lg font-semibold text-navy">How can we help?</h2>
              <button type="button" onClick={close} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close">
                <X className="size-5" aria-hidden />
              </button>
            </div>
            {repliesWaiting > 0 && (
              <a href="/dashboard/help" className="mb-4 block rounded-lg border border-orange/40 bg-orange/10 px-3 py-2 text-sm font-medium text-navy hover:bg-orange/20">
                You have {repliesWaiting === 1 ? 'a reply' : `${repliesWaiting} replies`} from the NextChapter team. Read {repliesWaiting === 1 ? 'it' : 'them'} →
              </a>
            )}
            <HelpFeedbackForm contextPath={pathname} contextTitle={title} onDone={close} />
          </div>
        </div>
      )}
    </>
  )
}
