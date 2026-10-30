'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { AudienceSection, actionButton } from '@/components/organizations/AudienceShell'
import { usePostHog } from '@/lib/posthog/client'
import type { RapidResponsePersonalization } from '@/lib/marketing/rapid-response-personalize'

// The personal line on https://launchyournextchapter.com/for-rapid-response. The page is one cached page for everyone;
// this fills in after it loads from /api/rapid-response/personalize (src/lib/marketing/rapid-response-personalize.ts):
// the organization of an emailed contact (nc_e in the address), the state an ad names (?s=KY), or a guess from the
// visitor's location. With nothing to say it renders nothing, so the page reads the same as before.

function demoHref(p: RapidResponsePersonalization): string {
  const q = new URLSearchParams({ from: 'rapid-response' })
  if (p.org) {
    q.set('name', p.org.name)
    if (p.org.city) q.set('city', p.org.city)
  }
  if (p.state) q.set('state', p.state.code)
  return `/demo/workforce?${q.toString()}`
}

export function RapidResponseBand() {
  const posthog = usePostHog()
  const [p, setP] = useState<RapidResponsePersonalization | null>(null)

  useEffect(() => {
    const here = new URLSearchParams(window.location.search)
    const q = new URLSearchParams()
    const e = here.get('nc_e')
    const s = here.get('s')
    if (e) q.set('e', e)
    if (s) q.set('s', s)
    const controller = new AbortController()
    fetch(`/api/rapid-response/personalize?${q.toString()}`, { signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<RapidResponsePersonalization>) : null))
      .then((data) => {
        if (!data || data.source === 'none') return
        setP(data)
        posthog?.capture('rapid_response_band_shown', { source: data.source, state: data.state?.code ?? null, hasOrg: !!data.org })
      })
      .catch(() => {})
    return () => controller.abort()
    // posthog is a stable stand-in; the lookup runs once per page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!p?.state && !p?.org) return null
  const { org, state } = p
  const title = org ? `Prepared for ${org.name}` : `Layoffs in ${state!.name}`

  return (
    <AudienceSection id="for-you" title={title}>
      <div className="max-w-2xl space-y-4">
        {state && (
          <p className="text-base leading-relaxed text-ink">
            {state.notices > 0 ? `${state.notices.toLocaleString()} WARN notices were filed in ${state.name} in the last 12 months. ` : ''}
            {state.boards} local workforce {state.boards === 1 ? 'board' : 'boards'} and {state.centers} American Job {state.centers === 1 ? 'Center' : 'Centers'} serve the workers affected.
          </p>
        )}
        {state && (
          <p className="text-sm text-muted-foreground">
            The notices and the board list are on{' '}
            <Link href={`/rapid-response/${state.name.toLowerCase().replace(/[^a-z]+/g, '-')}`} className="underline underline-offset-4">
              the {state.name} Rapid Response page
            </Link>
            .{p.source === 'region' && (
              <>
                {' '}
                We guessed {state.name} from your location. Not there? Pick your state on{' '}
                <Link href="/rapid-response" className="underline underline-offset-4">
                  the Rapid Response page
                </Link>
                .
              </>
            )}
          </p>
        )}
        <TrackedLink
          href={demoHref(p)}
          event="rapid_response_demo_cta_clicked"
          properties={{ source: p.source, state: state?.code ?? null, hasOrg: !!org, page: 'rapid_response' }}
          className={actionButton}
        >
          {org ? `Build the demo for ${org.name}` : `Build a demo for ${state!.name}`}
        </TrackedLink>
      </div>
    </AudienceSection>
  )
}
