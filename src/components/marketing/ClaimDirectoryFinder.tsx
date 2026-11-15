'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePostHog } from '@/lib/posthog/client'
import { ALL_STATE_CODES, stateName, stateSlug } from '@/lib/seo/states'

/**
 * Under "How to claim your page": pick a state and open that state's directory, where each organization's page
 * (and its Claim button) lives. A dropdown because there are more than five states.
 *
 * The dropdown opens the state with script, so a search engine sees no link from this page to any state directory, and the state
 * pages (and every college, non-profit and workforce board under them) were reachable only from a sitemap: the 2026-11-11 index
 * audit found all 10 sampled higher-education pages unknown to Google. The state list below is plain links for crawlers and for
 * anyone who prefers to click.
 */
export function ClaimDirectoryFinder({ path, noun, page }: { path: string; noun: string; page: string }) {
  const posthog = usePostHog()
  const router = useRouter()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function go(e: React.FormEvent) {
    e.preventDefault()
    if (!code) {
      setError('Choose a state first, then open its directory.')
      return
    }
    setError('')
    setBusy(true)
    posthog?.capture('claim_directory_opened', { page, state: code, directory: `/${path}`, via: 'select' })
    router.push(`/${path}/${stateSlug(code)}`)
  }

  return (
    <>
    <form onSubmit={go} className="mt-6 max-w-2xl space-y-3" style={busy ? { cursor: 'wait' } : undefined}>
      <label htmlFor="claim-directory-state" className="block text-base font-semibold text-ink">
        Find your {noun} in the directory
      </label>
      <p className="text-sm text-muted-foreground">Choose your state to see its directory. Open your organization there and use Claim this page.</p>
      <div className="flex flex-wrap items-center gap-3">
        <select
          id="claim-directory-state"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          aria-describedby={error ? 'claim-directory-error' : undefined}
          className="h-11 min-w-56 rounded-lg border border-border bg-white px-3 text-base text-ink"
        >
          <option value="">Choose a state</option>
          {ALL_STATE_CODES.map((c) => (
            <option key={c} value={c}>
              {stateName(c)}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={busy}
          className="h-11 rounded-full bg-action px-6 text-base font-semibold text-action-foreground hover:brightness-95 disabled:opacity-70"
          style={busy ? { cursor: 'wait' } : undefined}
        >
          {busy ? 'Opening the directory…' : 'Open the directory'}
        </button>
      </div>
      {error && (
        <p id="claim-directory-error" role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
    <nav aria-label={`Browse ${noun} directories by state`} className="mt-6 max-w-3xl">
      <h3 className="text-sm font-semibold text-ink">Or browse by state</h3>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {ALL_STATE_CODES.map((c) => (
          <li key={c}>
            <a
              href={`/${path}/${stateSlug(c)}`}
              className="text-brand underline underline-offset-4"
              onClick={() => posthog?.capture('claim_directory_opened', { page, state: c, directory: `/${path}`, via: 'link' })}
            >
              {stateName(c)}
            </a>
          </li>
        ))}
      </ul>
    </nav>
    </>
  )
}
