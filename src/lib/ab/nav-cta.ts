'use client'

import { useEffect, useState } from 'react'

// Nav button label test (started 2026-11-03): "Get your Market Reality Assessment" vs
// "Get your Hireability Score". Assignment is a 50/50 coin flip in the browser, kept in
// localStorage so a visitor sees one label for the whole test. It stays client-side on purpose:
// the nav is on statically cached public pages, and reading a cookie on the server would make
// them all dynamic. Server render and first paint are always the control, so there is no
// hydration mismatch; a B visitor sees the label swap right after load.
export type NavCtaVariant = 'control' | 'hire_score'

export const NAV_CTA_LABEL: Record<NavCtaVariant, string> = {
  control: 'Get your Market Reality Assessment',
  hire_score: 'Get your Hireability Score',
}

const KEY = 'nc_nav_cta_variant'

export function readOrAssignNavCtaVariant(): NavCtaVariant {
  try {
    const saved = window.localStorage.getItem(KEY)
    if (saved === 'control' || saved === 'hire_score') return saved
    const picked: NavCtaVariant = Math.random() < 0.5 ? 'control' : 'hire_score'
    window.localStorage.setItem(KEY, picked)
    return picked
  } catch {
    // Storage blocked: show the control and let the visitor stay out of the test.
    return 'control'
  }
}

// null until the browser has read or assigned the visitor's variant (server render and first
// paint), so callers can show the control label but hold exposure events until it is known.
export function useNavCtaVariant(): NavCtaVariant | null {
  const [variant, setVariant] = useState<NavCtaVariant | null>(null)
  useEffect(() => setVariant(readOrAssignNavCtaVariant()), [])
  return variant
}
