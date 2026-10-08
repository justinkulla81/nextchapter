'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePostHog } from 'posthog-js/react'
import { Logo } from '@/components/Logo'
import { NewsletterSignup } from '@/components/marketing/NewsletterSignup'
import { ReportPdfGateDialog } from './ReportPdfGateDialog'
import { ReportNewsletterPopup } from './ReportNewsletterPopup'
import { hasSubscribedCookie } from './use-subscribed'

/**
 * Client-side enhancements layered onto the server-rendered report blob. The
 * report is complete and readable without any of this; here we only:
 *  - render the real <Logo/> in the cover wordmark
 *  - put the newsletter form in the "Get the next edition" slot
 *  - gate the "Download PDF" button behind an email (subscribers pass through;
 *    press/researchers use the ungated #pdf-direct link)
 *  - track downloads of the free, ungated brief (#brief-btn)
 *  - show the polite scroll/time pop-up
 */
export function ReportEnhancements({
  pdfHref,
  pdfFilename,
  popupPlacement,
}: {
  pdfHref: string
  pdfFilename: string
  popupPlacement: string
}) {
  const posthog = usePostHog()
  const [targets, setTargets] = useState<{ wordmark: HTMLElement | null; slot: HTMLElement | null }>({
    wordmark: null,
    slot: null,
  })
  const [pdfOpen, setPdfOpen] = useState(false)

  useEffect(() => {
    const wm = document.querySelector<HTMLElement>('.ncr .wordmark')
    if (wm) wm.textContent = ''
    const slot = document.querySelector<HTMLElement>('#newsletter-slot')
    if (slot) slot.textContent = ''

    const pdfBtn = document.getElementById('pdf-btn')
    const onPdf = (e: Event) => {
      if (hasSubscribedCookie()) return // already subscribed: let the download happen
      e.preventDefault()
      setPdfOpen(true)
      posthog?.capture('report_pdf_gate_shown', {})
    }
    pdfBtn?.addEventListener('click', onPdf)

    const direct = document.getElementById('pdf-direct')
    const onDirect = () => posthog?.capture('report_pdf_downloaded', { gated: false, channel: 'direct' })
    direct?.addEventListener('click', onDirect)

    const brief = document.getElementById('brief-btn')
    const onBrief = () => posthog?.capture('report_brief_downloaded', { href: brief?.getAttribute('href') })
    brief?.addEventListener('click', onBrief)

    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-only: expose the server-rendered nodes as portal targets
    setTargets({ wordmark: wm, slot })
    return () => {
      pdfBtn?.removeEventListener('click', onPdf)
      direct?.removeEventListener('click', onDirect)
      brief?.removeEventListener('click', onBrief)
    }
  }, [posthog])

  return (
    <>
      {targets.wordmark && createPortal(<Logo />, targets.wordmark)}
      {targets.slot && createPortal(<NewsletterSignup variant="inline" source="displacement-report" />, targets.slot)}
      <ReportPdfGateDialog open={pdfOpen} onOpenChange={setPdfOpen} pdfHref={pdfHref} filename={pdfFilename} />
      <ReportNewsletterPopup placement={popupPlacement} />
    </>
  )
}
