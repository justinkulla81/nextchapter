'use client'

import { useState } from 'react'
import { usePostHog } from '@/lib/posthog/client'

const SITE = 'https://launchyournextchapter.com'

/**
 * "Link to this page": a text link and a badge for the organization this page is about to put on its own site.
 * An organization with a public page here has a reason to link to it (it is free, and shows jobs, funding and layoff help
 * for its people), and this makes that one paste. Fires embed_snippet_copied-style analytics with the page and format.
 */
export function LinkToUs({ path, name, kind }: { path: string; name: string; kind: string }) {
  const posthog = usePostHog()
  const [copied, setCopied] = useState<string | null>(null)
  const url = `${SITE}${path}`
  const text = `<a href="${url}">${name} on NextChapter</a>`
  const badge = `<a href="${url}"><img src="${SITE}/badges/listed-on-nextchapter.svg" width="220" height="44" alt="${name} is listed on NextChapter"></a>`

  async function copy(format: 'text' | 'badge', code: string) {
    posthog?.capture('link_to_us_copied', { path, kind, format })
    try {
      await navigator.clipboard.writeText(code)
      setCopied(format)
      setTimeout(() => setCopied(null), 2500)
    } catch {
      setCopied(null)
    }
  }

  return (
    <section aria-labelledby="link-to-us" className="mt-12 rounded-xl border border-border bg-white p-5">
      <h2 id="link-to-us" className="text-lg font-semibold tracking-tight text-navy">Link to this page from your site</h2>
      <p className="mt-1 text-sm text-muted-foreground">Free for {name} to use. Paste either into your website.</p>
      {([['text', 'Text link', text], ['badge', 'Badge', badge]] as const).map(([format, label, code]) => (
        <div key={format} className="mt-3">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor={`link-to-us-${format}`} className="text-sm font-medium text-navy">{label}</label>
            <button type="button" onClick={() => copy(format, code)} className="rounded-md border border-border px-3 py-1 text-xs font-semibold text-navy hover:border-brand">{copied === format ? 'Copied' : 'Copy'}</button>
          </div>
          <textarea id={`link-to-us-${format}`} readOnly rows={format === 'badge' ? 3 : 2} value={code} onFocus={(e) => e.currentTarget.select()} className="mt-1 w-full rounded-lg border border-border bg-off-white p-2 font-mono text-xs" />
        </div>
      ))}
    </section>
  )
}
