'use client'

import { useSyncExternalStore } from 'react'

// Nav button label test (started 2026-11-03; fourth arm "Join free" added the same day): "Get your Market
// Reality Assessment" vs "Get your Hireability Score" vs "Score My Resume" vs "Join free". Assignment is an
// even four-way coin flip in the browser, kept in
// localStorage so a visitor sees one label for the whole test. It stays client-side on purpose:
// the nav is on statically cached public pages, and reading a cookie on the server would make
// them all dynamic. Server render and first paint are always the control, so there is no
// hydration mismatch; a B visitor sees the label swap right after load.
export type NavCtaVariant = 'control' | 'hire_score' | 'resume_score' | 'join_free'

const VARIANTS: NavCtaVariant[] = ['control', 'hire_score', 'resume_score', 'join_free']

export const NAV_CTA_LABEL: Record<NavCtaVariant, string> = {
  control: 'Get your Market Reality Assessment',
  hire_score: 'Get your Hireability Score',
  resume_score: 'Score My Resume',
  join_free: 'Join free',
}

const KEY = 'nc_nav_cta_variant'

export function readOrAssignNavCtaVariant(): NavCtaVariant {
  try {
    const saved = window.localStorage.getItem(KEY)
    if (VARIANTS.includes(saved as NavCtaVariant)) return saved as NavCtaVariant
    const picked = VARIANTS[Math.floor(Math.random() * VARIANTS.length)]
    window.localStorage.setItem(KEY, picked)
    return picked
  } catch {
    // Storage blocked: show the control and let the visitor stay out of the test.
    return 'control'
  }
}

const subscribe = () => () => {}

// null on the server and during hydration (callers show the control label and hold exposure
// events); the visitor's variant once the browser has read or assigned it.
export function useNavCtaVariant(): NavCtaVariant | null {
  return useSyncExternalStore(subscribe, readOrAssignNavCtaVariant, () => null)
}
