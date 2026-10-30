'use client'

import { useMemo, useState } from 'react'
import { usePostHog } from '@/lib/posthog/client'

type Option = { slug: string; label: string }

const SITE = 'https://launchyournextchapter.com'

// Picks a widget and a state or industry, shows it live, and gives the copy-paste snippet. The snippet carries a plain
// text link under the frame, so the page that embeds it links to ours even where iframes are stripped.
export function EmbedBuilder({ states, industries, jobs }: { states: Option[]; industries: Option[]; jobs: Option[] }) {
  const posthog = usePostHog()
  const [widget, setWidget] = useState<'layoffs' | 'hiring' | 'benefits' | 'ai-job-check'>('layoffs')
  const [target, setTarget] = useState<{ layoffs: string; hiring: string; benefits: string; 'ai-job-check': string }>({ layoffs: states[0]?.slug ?? '', hiring: industries[0]?.slug ?? '', benefits: states[0]?.slug ?? '', 'ai-job-check': jobs[0]?.slug ?? '' })
  const [copied, setCopied] = useState(false)
  const options = widget === 'hiring' ? industries : widget === 'ai-job-check' ? jobs : states
  const slug = target[widget]
  const label = options.find((o) => o.slug === slug)?.label ?? slug
  const snippet = useMemo(() => {
    const src = `${SITE}/embed/${widget}/${slug}`
    const page = widget === 'ai-job-check' ? `/tools/ai-job-check/${slug}` : widget === 'layoffs' ? `/layoffs/${slug}` : widget === 'hiring' ? `/industries/${slug}` : `/unemployment-benefits/${slug}`
    const text = widget === 'ai-job-check' ? `AI exposure for ${label}` : widget === 'layoffs' ? `${label} layoffs: WARN notices` : widget === 'hiring' ? `${label}: jobs, conferences and layoffs` : `${label} unemployment benefits`
    return `<iframe src="${src}" width="100%" height="${widget === 'benefits' ? 300 : widget === 'ai-job-check' ? 230 : 420}" style="border:0;max-width:560px" loading="lazy" title="${text}"></iframe>\n<p><a href="${SITE}${page}">${text}</a>, from NextChapter</p>`
  }, [widget, slug, label])

  async function copy() {
    posthog?.capture('embed_snippet_copied', { widget, target: slug })
    try {
      await navigator.clipboard.writeText(snippet)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Widget">
        {([['layoffs', 'Layoff notices'], ['hiring', 'Jobs hiring'], ['benefits', 'Unemployment benefits'], ['ai-job-check', 'AI exposure for a job']] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setWidget(k)} aria-pressed={widget === k} className={`rounded-full border px-3 py-1.5 text-sm ${widget === k ? 'border-brand bg-brand text-white' : 'border-border text-navy'}`}>{l}</button>
        ))}
      </div>
      <label htmlFor="embed-target" className="mt-4 block text-sm font-medium text-navy">{widget === 'hiring' ? 'Industry' : widget === 'ai-job-check' ? 'Job' : 'State'}</label>
      <select id="embed-target" value={slug} onChange={(e) => setTarget((t) => ({ ...t, [widget]: e.target.value }))} className="mt-1 w-full max-w-sm rounded-lg border border-border bg-white px-3 py-2 text-sm">
        {options.map((o) => <option key={o.slug} value={o.slug}>{o.label}</option>)}
      </select>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-navy">Preview</p>
          <iframe key={`${widget}-${slug}`} src={`/embed/${widget}/${slug}`} title={`${label} widget preview`} className="mt-2 w-full max-w-[560px] border-0" style={{ height: widget === 'benefits' ? 300 : widget === 'ai-job-check' ? 230 : 420 }} loading="lazy" />
        </div>
        <div>
          <p className="text-sm font-medium text-navy">Copy this into your page</p>
          <textarea readOnly value={snippet} rows={7} className="mt-2 w-full rounded-lg border border-border bg-off-white p-3 font-mono text-xs" aria-label="Embed code" onFocus={(e) => e.currentTarget.select()} />
          <button type="button" onClick={copy} className="mt-2 rounded-lg bg-action px-4 py-2 text-sm font-semibold text-action-foreground hover:brightness-95">{copied ? 'Copied' : 'Copy embed code'}</button>
          <p className="mt-2 text-xs text-muted-foreground">Free to use. Keep the link under the frame; it is how readers reach the full page.</p>
        </div>
      </div>
    </div>
  )
}
