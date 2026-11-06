'use client'

import { useState } from 'react'
import { posthog } from '@/lib/posthog/client'

interface DownloadFile { label: string; note: string; href: string; type: 'pdf' | 'data' | 'method' }

// Downloads, the embeddable chart and the data note for the October 2026 edition. Every click is an event with the edition and the
// file, so the admin can see what reporters and researchers actually take.
export function ReportDownloads({ edition, files, pageUrl, chartUrl, chartAlt }: { edition: string; files: DownloadFile[]; pageUrl: string; chartUrl: string; chartAlt: string }) {
  const [copied, setCopied] = useState(false)
  const snippet = `<a href="${pageUrl}"><img src="${chartUrl}" alt="${chartAlt}" width="800"></a><br>Source: NextChapter White Collar Employment Report, October 2026.`
  const event = (f: DownloadFile) => (f.type === 'pdf' ? 'report_pdf_downloaded' : 'report_data_downloaded')
  return (
    <section aria-labelledby="report-downloads" className="mb-6 rounded-xl border border-border bg-white p-5">
      <h2 id="report-downloads" className="text-base font-semibold tracking-tight text-navy">Download the report, data and methods</h2>
      <p className="mt-1 text-sm text-muted-foreground">Aggregate figures only. Free to use with a link back.</p>
      <ul className="mt-3 divide-y divide-border">
        {files.map((f) => (
          <li key={f.href} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
            <a
              href={f.href}
              download
              onClick={() => posthog.capture(event(f), { edition, file: f.href, source: 'report_page' })}
              className="text-sm font-medium text-brand underline underline-offset-4"
            >
              {f.label}
            </a>
            <span className="text-xs text-muted-foreground">{f.note}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Embed the chart on your site</p>
      <p className="mt-1 select-all break-all rounded-lg bg-off-white p-3 font-mono text-xs text-navy">{snippet}</p>
      <button
        type="button"
        className="mt-2 inline-flex h-9 items-center rounded-full border border-border bg-white px-4 text-sm font-medium text-ink hover:bg-muted"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(snippet)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          } catch {
            // Clipboard blocked: the snippet above is selectable.
          }
          posthog.capture('report_chart_shared', { edition, channel: 'embed_copy', source: 'report_page' })
        }}
      >
        {copied ? 'Snippet copied' : 'Copy embed code'}
      </button>
    </section>
  )
}
