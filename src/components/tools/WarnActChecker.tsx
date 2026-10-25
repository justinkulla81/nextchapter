'use client'

import { useState } from 'react'
import { usePostHog } from '@/lib/posthog/client'
import { checkWarn, type WarnResult } from '@/lib/tools/warn-check'

const FIELD = 'mt-1 h-11 w-full rounded-lg border border-border bg-white px-3 text-base'

const HEADLINE: Record<WarnResult['verdict'], string> = {
  not_covered_employer: 'WARN likely does not apply to this employer',
  notice_likely_required: 'Federal WARN notice is likely required',
  notice_likely_not_required: 'Federal WARN notice is likely not required',
}

export function WarnActChecker() {
  const posthog = usePostHog()
  const [employer, setEmployer] = useState('')
  const [site, setSite] = useState('')
  const [losses, setLosses] = useState('')
  const [shutdown, setShutdown] = useState(false)
  const [result, setResult] = useState<WarnResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  function run(e: React.FormEvent) {
    e.preventDefault()
    const input = { employerFullTime: Number(employer), siteFullTime: Number(site), lossesAtSite: Number(losses), isShutdown: shutdown }
    if (![input.employerFullTime, input.siteFullTime, input.lossesAtSite].every((n) => Number.isFinite(n) && n >= 0) || !employer || !site || !losses) {
      setError('Enter all three numbers, using zero or more.')
      return
    }
    if (input.lossesAtSite > input.siteFullTime) {
      setError('Job losses at the site cannot be more than the site’s full-time employees.')
      return
    }
    setError(null)
    const r = checkWarn(input)
    setResult(r)
    posthog?.capture('warn_checker_run', { verdict: r.verdict, isShutdown: shutdown, employerSizeBand: input.employerFullTime < 100 ? 'under_100' : input.employerFullTime < 500 ? '100_499' : '500_plus' })
  }

  return (
    <form onSubmit={run} className="mt-8 max-w-xl space-y-4 rounded-xl border border-border bg-white p-6" noValidate>
      <label className="block text-sm font-medium text-navy">
        Full-time employees across the whole employer
        <input inputMode="numeric" className={FIELD} value={employer} onChange={(e) => setEmployer(e.target.value)} />
      </label>
      <label className="block text-sm font-medium text-navy">
        Full-time employees at the affected site
        <input inputMode="numeric" className={FIELD} value={site} onChange={(e) => setSite(e.target.value)} />
      </label>
      <label className="block text-sm font-medium text-navy">
        Full-time employees at that site losing their jobs within 30 days
        <input inputMode="numeric" className={FIELD} value={losses} onChange={(e) => setLosses(e.target.value)} />
      </label>
      <label className="flex items-center gap-2 text-sm text-navy">
        <input type="checkbox" checked={shutdown} onChange={(e) => setShutdown(e.target.checked)} />
        The site or operating unit is shutting down
      </label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="submit" className="inline-flex h-12 items-center rounded-full bg-action px-6 text-base font-semibold text-action-foreground hover:brightness-95">
        Check WARN notice
      </button>
      {result && (
        <div role="status" className="rounded-lg bg-off-white p-4 text-sm">
          <p className="text-base font-semibold text-navy">{HEADLINE[result.verdict]}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">{result.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      )}
    </form>
  )
}
