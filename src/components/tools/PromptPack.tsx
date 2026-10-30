'use client'

import { useState } from 'react'
import { posthog } from '@/lib/posthog/client'
import { fillPrompt, PROMPTS, type PromptJob } from '@/lib/ai-check/prompts'

// The prompt pack: pick your job (optional) and each prompt fills in your job's page address. Copy fires prompt_pack_copied.
export function PromptPack({ jobs }: { jobs: PromptJob[] }) {
  const [url, setUrl] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const job = jobs.find((j) => j.url === url) ?? null

  async function copy(id: string, text: string) {
    posthog.capture('prompt_pack_copied', { promptId: id, jobChosen: Boolean(job), jobUrl: job?.url ?? null })
    try {
      await navigator.clipboard.writeText(text)
      setCopied(id)
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 2500)
    } catch {
      setCopied(null)
    }
  }

  return (
    <div>
      <label htmlFor="pack-job" className="block text-sm font-medium text-navy">Your job (optional, fills in the page address)</label>
      <select
        id="pack-job"
        value={url}
        onChange={(e) => {
          setUrl(e.target.value)
          posthog.capture('prompt_pack_job_chosen', { jobUrl: e.target.value || null })
        }}
        className="mt-1 w-full max-w-md rounded-lg border border-border bg-white px-3 py-2 text-sm"
      >
        <option value="">Choose your job</option>
        {jobs.map((j) => <option key={j.url} value={j.url}>{j.title}</option>)}
      </select>
      <ul className="mt-6 space-y-4">
        {PROMPTS.map((p) => {
          const text = fillPrompt(p, job)
          return (
            <li key={p.id} id={p.id} className="rounded-xl border border-border bg-white p-4">
              <h3 className="text-base font-semibold text-navy">{p.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{p.when}</p>
              <pre className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-off-white p-3 font-sans text-sm text-navy">{text}</pre>
              <button type="button" onClick={() => copy(p.id, text)} className="mt-3 rounded-lg bg-action px-4 py-2 text-sm font-semibold text-action-foreground hover:brightness-95">
                {copied === p.id ? 'Copied' : 'Copy prompt'}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
