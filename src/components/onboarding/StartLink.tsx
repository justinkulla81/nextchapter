'use client'

import Link from 'next/link'
import type { ComponentProps, MouseEvent } from 'react'
import { posthog } from '@/lib/posthog/client'
import { START_COOKIE, START_EVENT, startDestination, type StartGateDetail } from '@/lib/onboarding/start-gate'

function alreadyStarted(): boolean {
  try {
    return document.cookie.split('; ').some((c) => c.startsWith(`${START_COOKIE}=`))
  } catch {
    return false
  }
}

/**
 * Every button that starts registration on a public page. It is a real link to the first question (so it works without script,
 * with a middle click, and for crawlers), but a plain click opens the email box in place (StartGateHost) so we get the address
 * before the first question, with the payoff for giving it. Someone who has already given an address, or a page where the box
 * is not mounted, goes straight on.
 */
export function StartLink({
  href,
  source,
  situation,
  event,
  properties,
  gtagEvent,
  onNavigate,
  onClick,
  ...rest
}: Omit<ComponentProps<typeof Link>, 'href'> & {
  href: string
  /** Which button on which page ('home_hero', 'top_<slug>'). */
  source: string
  situation?: string
  event?: string
  properties?: Record<string, unknown>
  gtagEvent?: string
  /** Runs on click before anything opens (hand a value to the next page). */
  onNavigate?: () => void
}) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    try {
      if (event) posthog.capture(event, properties)
      if (gtagEvent && typeof window.gtag === 'function') window.gtag('event', gtagEvent, properties)
      onNavigate?.()
    } catch {
      // Analytics and hand-offs never break a click.
    }
    onClick?.(e)
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    // Portal and customer hosts hand /onboarding to the main site, so a session started there would be lost: those go straight on.
    const h = window.location.hostname
    if (h.endsWith('.launchyournextchapter.com') && h !== 'www.launchyournextchapter.com') return
    const hostMounted = (window as unknown as { __ncStartGate?: boolean }).__ncStartGate
    if (!href.startsWith('/onboarding/') || !hostMounted || alreadyStarted() || window.location.pathname.startsWith('/onboarding')) return
    e.preventDefault()
    const detail: StartGateDetail = { href: startDestination(href, source), source, situation }
    window.dispatchEvent(new CustomEvent(START_EVENT, { detail }))
  }
  return <Link href={href} onClick={handle} {...rest} />
}
