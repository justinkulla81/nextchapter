'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/Logo'
import { cn } from '@/lib/utils'
import { posthog } from '@/lib/posthog/client'
import { PUBLIC_NAV, type PublicNavMenu } from '@/lib/nav/public-nav'
import { MARKET_REALITY_START_HREF } from '@/lib/onboarding/resume-rule'
import { NAV_CTA_LABEL, useNavCtaVariant } from '@/lib/ab/nav-cta'

const TOP = 'inline-flex items-center gap-1 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground'

function track(event: string, props: Record<string, unknown>) {
  try {
    posthog.capture(event, props)
  } catch {}
}

function Panel({ menu, onPick }: { menu: PublicNavMenu; onPick: (href: string) => void }) {
  return (
    <div className={cn('grid gap-x-8 gap-y-6 p-6', menu.groups.length > 2 ? 'grid-cols-3' : 'grid-cols-2')}>
      {menu.groups.map((g) => (
        <div key={g.heading}>
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{g.heading}</p>
          <ul className="mt-2 space-y-0.5">
            {g.links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} onClick={() => onPick(l.href)} className="block rounded-md px-2 py-1.5 hover:bg-muted">
                  <span className="text-sm font-medium text-foreground">{l.label}</span>
                  {l.hint && <span className="block text-xs text-muted-foreground">{l.hint}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

/**
 * The public site's header: four menus (Jobs, Data, Get help, For organizations), Log in, and one primary action.
 * Menu links are in the page HTML even while a menu is closed, so search engines still follow them.
 * The links come from src/lib/nav/public-nav.ts, the same list the footer reads.
 */
export function SiteNavMega({ current }: { current?: PublicNavMenu['key'] }) {
  const [openKey, setOpenKey] = useState<PublicNavMenu['key'] | null>(null)
  const [phoneOpen, setPhoneOpen] = useState(false)
  const assigned = useNavCtaVariant()
  const ctaVariant = assigned ?? 'control'
  // Exposure: once per tab session, so click rate has a denominator per variant.
  useEffect(() => {
    if (!assigned) return
    try {
      if (window.sessionStorage.getItem('nc_nav_cta_seen')) return
      window.sessionStorage.setItem('nc_nav_cta_seen', '1')
    } catch {}
    track('site_nav_cta_shown', { cta_variant: assigned })
  }, [assigned])
  const barRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!openKey) return
    const onDown = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpenKey(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenKey(null)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [openKey])

  const toggle = (key: PublicNavMenu['key']) => {
    setOpenKey((k) => {
      if (k !== key) track('site_nav_menu_opened', { menu: key })
      return k === key ? null : key
    })
  }
  const picked = (menu: PublicNavMenu['key'], href: string) => {
    track('site_nav_link_clicked', { menu, href, device: 'desktop' })
    setOpenKey(null)
  }

  return (
    <div className="relative">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" aria-label="NextChapter home">
          <Logo className="text-2xl sm:text-3xl" />
        </Link>

        <nav ref={barRef} aria-label="Main" className="hidden flex-1 items-center justify-center gap-1 lg:flex">
          {PUBLIC_NAV.map((m) => (
            <div key={m.key} className={cn(m.key === 'orgs' && 'ml-4')}>
              <button
                type="button"
                id={`nav-${m.key}`}
                aria-expanded={openKey === m.key}
                aria-controls={`nav-panel-${m.key}`}
                aria-current={current === m.key ? 'true' : undefined}
                onClick={() => toggle(m.key)}
                className={cn(TOP, m.key === 'orgs' && 'text-brand', current === m.key && 'text-foreground')}
              >
                {m.label}
                <ChevronDown className={cn('size-3.5 transition-transform', openKey === m.key && 'rotate-180')} aria-hidden />
              </button>
              <div
                id={`nav-panel-${m.key}`}
                role="region"
                aria-labelledby={`nav-${m.key}`}
                hidden={openKey !== m.key}
                className="absolute inset-x-0 top-full z-40 mx-auto mt-1 w-[min(60rem,100%-3rem)] rounded-xl border border-border bg-white shadow-xl"
              >
                <Panel menu={m} onPick={(href) => picked(m.key, href)} />
              </div>
            </div>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/auth/login" className="hidden whitespace-nowrap text-sm font-medium text-foreground/80 hover:text-foreground sm:inline-block">
            Log in
          </Link>
          <Button
            nativeButton={false}
            render={<Link href={MARKET_REALITY_START_HREF} onClick={() => track('site_nav_cta_clicked', { cta: 'get_assessment', cta_variant: ctaVariant })} />}
            variant="cta"
            className="hidden sm:inline-flex"
          >
            {/* Below xl the control drops "Market Reality" (and the score label drops "Get your") so the button fits beside the nav links. */}
            {ctaVariant === 'control'
              ? <>Get your <span className="hidden xl:inline">Market Reality </span>Assessment</>
              : ctaVariant === 'hire_score'
                ? <><span className="hidden xl:inline">Get your </span>Hireability Score</>
                : NAV_CTA_LABEL.resume_score}
          </Button>
          <button
            type="button"
            onClick={() => setPhoneOpen(true)}
            aria-label="Open the menu"
            aria-expanded={phoneOpen}
            className="inline-flex size-10 items-center justify-center rounded-md border border-border lg:hidden"
          >
            <Menu className="size-5" aria-hidden />
          </button>
        </div>
      </div>

      {phoneOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-white lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="flex items-center justify-between px-4 py-4">
            <Logo className="text-2xl" />
            <button type="button" onClick={() => setPhoneOpen(false)} aria-label="Close the menu" className="inline-flex size-10 items-center justify-center rounded-md border border-border">
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="space-y-2 px-4 pb-10">
            <Button nativeButton={false} render={<Link href={MARKET_REALITY_START_HREF} onClick={() => track('site_nav_cta_clicked', { cta: 'get_assessment', device: 'phone', cta_variant: ctaVariant })} />} variant="cta" className="h-11 w-full">
              {NAV_CTA_LABEL[ctaVariant]}
            </Button>
            {PUBLIC_NAV.map((m) => (
              <details key={m.key} className="group border-b border-border py-1">
                <summary className="flex cursor-pointer list-none items-center justify-between py-3 text-base font-semibold text-foreground">
                  {m.label}
                  <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <div className="space-y-4 pb-4">
                  {m.groups.map((g) => (
                    <div key={g.heading}>
                      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{g.heading}</p>
                      <ul className="mt-1">
                        {g.links.map((l) => (
                          <li key={l.href}>
                            <Link
                              href={l.href}
                              onClick={() => {
                                track('site_nav_link_clicked', { menu: m.key, href: l.href, device: 'phone' })
                                setPhoneOpen(false)
                              }}
                              className="block py-2 text-sm text-foreground"
                            >
                              {l.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </details>
            ))}
            <Link href="/auth/login" className="block py-3 text-base font-semibold text-foreground">
              Log in
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
