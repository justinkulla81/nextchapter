'use client'

import posthog from 'posthog-js'
import { useEffect, useRef } from 'react'
import { NAV_CTA_LABEL, useNavCtaVariant } from '@/lib/ab/nav-cta'

/**
 * Button text for any link into the Market Reality Assessment, part of the same four-way label
 * test as the nav button (see lib/ab/nav-cta.ts): visitors in an arm see that arm's label on every
 * assessment button. Only copy that names the assessment is tested; other button copy ("Join free
 * and see what you qualify for") passes through untouched. Server render and first paint are the
 * control copy, so cached pages stay static and hydration matches.
 */
export function AssessmentCtaLabel({ children }: { children: string }) {
  const variant = useNavCtaVariant()
  const tested = /assessment/i.test(children)
  const ref = useRef<HTMLSpanElement>(null)

  // Clicks on the enclosing link carry the arm so click-through compares per label everywhere.
  useEffect(() => {
    const link = ref.current?.closest('a')
    if (!link || !variant || !tested) return
    const onClick = () => {
      try {
        posthog.capture('assessment_cta_clicked', { cta_variant: variant, path: window.location.pathname })
      } catch {}
    }
    link.addEventListener('click', onClick)
    return () => link.removeEventListener('click', onClick)
  }, [variant, tested])

  const text = tested && variant && variant !== 'control' ? NAV_CTA_LABEL[variant] : children
  return <span ref={ref}>{text}</span>
}
