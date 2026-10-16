'use client'

import { useState, useTransition } from 'react'
import { usePostHog } from 'posthog-js/react'
import { openDemoRoleAction } from '@/app/p/[slug]/actions'

export interface FrontDoorItem {
  key: string
  title: string
  blurb: string
  /** Live portals link straight to sign-in. */
  href?: string
  /** Demo roles open a signed-in sample account. */
  demo?: boolean
  /** Button text, e.g. "Explore as administrator". */
  actionLabel: string
}

// One card per portal (or per demo role). The first is the screen's primary action.
export function FrontDoorPortals({ slug, items }: { slug: string; items: FrontDoorItem[] }) {
  const posthog = usePostHog()
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function openDemo(item: FrontDoorItem) {
    setError(null)
    setPendingKey(item.key)
    posthog?.capture('front_door_portal_clicked', { slug, portal: item.key, demo: true })
    start(async () => {
      const r = await openDemoRoleAction(slug, item.key)
      if (r.url) {
        window.location.assign(r.url)
        return
      }
      setPendingKey(null)
      setError(r.error ?? 'Could not open the demo. Try again.')
    })
  }

  if (items.length === 0) {
    return <p className="text-muted-foreground">No portals are set up for this organization yet. Contact your NextChapter representative.</p>
  }

  return (
    <div className={`space-y-4 ${pending ? 'cursor-wait' : ''}`}>
      <ul className="grid gap-4 sm:grid-cols-2">
        {items.map((item, i) => {
          const primary = i === 0
          const cls = `inline-flex rounded-full px-5 py-2.5 text-sm font-semibold disabled:cursor-wait disabled:opacity-60 ${primary ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-muted'}`
          return (
            <li key={item.key} className="flex flex-col justify-between gap-4 rounded-lg border border-border bg-card p-5 text-card-foreground">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">{item.title}</h2>
                <p className="text-sm text-muted-foreground">{item.blurb}</p>
              </div>
              {item.demo ? (
                <button type="button" onClick={() => openDemo(item)} disabled={pending} className={cls}>
                  {pendingKey === item.key ? 'Opening…' : item.actionLabel}
                </button>
              ) : (
                <a href={item.href} onClick={() => posthog?.capture('front_door_portal_clicked', { slug, portal: item.key, demo: false })} className={cls}>
                  {item.actionLabel}
                </a>
              )}
            </li>
          )
        })}
      </ul>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
