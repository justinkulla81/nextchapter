'use client'

import { useEffect, useRef } from 'react'
import { posthog } from '@/lib/posthog/client'
import {
  AEI_LABEL,
  AEI_SOURCE_NOTE,
  AEI_SOURCE_URL,
  COLLAB_LINE,
  EXPOSURE_LEVEL_LABEL,
  exposureSummary,
  type AiExposureView,
} from '@/lib/aei/job-exposure'

// AI exposure from the Anthropic Economic Index (src/lib/aei/job-exposure.ts): how much people use Claude
// for this occupation's tasks. Never a job-loss forecast, so the copy never says "at risk".

/** The list row's one small badge, shown only for High. */
export function AiExposureBadge() {
  return (
    <span
      title="AI exposure (Anthropic Economic Index): High. People use AI on at least half of this occupation's tasks."
      className="mr-2 inline-flex items-center rounded-full border border-border px-2 py-px text-[11px] font-medium whitespace-nowrap text-ink"
    >
      High AI exposure
    </span>
  )
}

// Reported once per job and page view, when the block is actually seen (it can sit in a closed panel).
const seen = new Set<string>()

/** The job drawer's details: level, automate vs augment, what AI is used for, and the source. */
export function AiExposureDetail({ jobId, view, surface }: { jobId: string; view: AiExposureView; surface: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    const key = `${surface}:${jobId}`
    if (!el || seen.has(key) || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting) || seen.has(key)) return
      seen.add(key)
      posthog.capture('job_ai_exposure_viewed', { jobId, level: view.level, collab: view.collab, occupation: view.occupation, socSource: view.source, surface })
      io.disconnect()
    })
    io.observe(el)
    return () => io.disconnect()
  }, [jobId, view, surface])
  return (
    <div ref={ref} className="space-y-1.5 text-sm" data-ai-exposure={view.level}>
      <p className="text-ink">
        <span className="font-semibold">
          {AEI_LABEL}: {EXPOSURE_LEVEL_LABEL[view.level]}.
        </span>{' '}
        {view.collab ? COLLAB_LINE[view.collab] : null}
      </p>
      <details
        className="text-muted-foreground"
        onToggle={(e) => {
          if ((e.currentTarget as HTMLDetailsElement).open) posthog.capture('job_ai_exposure_details_opened', { jobId, level: view.level, surface })
        }}
      >
        <summary className="cursor-pointer text-sm text-ink underline-offset-4 hover:underline">What this means</summary>
        <div className="space-y-1.5 pt-1.5">
          <p>
            Occupation: {view.occupation}. {AEI_SOURCE_NOTE[view.source]} {exposureSummary(view.level, view.tasksUsed, view.taskCount)}
          </p>
          {view.automationPct !== null && view.augmentationPct !== null && (
            <p>
              In those conversations, {Math.round(view.augmentationPct)}% augment the person (AI helps them do it) and {Math.round(view.automationPct)}% automate the
              task (AI does it).
            </p>
          )}
          {view.topTasks.length > 0 && (
            <div>
              <p>Tasks people use AI for most:</p>
              <ul className="list-disc space-y-0.5 pl-5">
                {view.topTasks.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          )}
          <p>High means AI is used on at least half of the occupation&apos;s tasks; Medium, at least a quarter; Low, less. It measures use of AI, not job loss.</p>
        </div>
      </details>
      <p className="text-xs text-muted-foreground">
        Source:{' '}
        <a href={AEI_SOURCE_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
          Anthropic Economic Index
        </a>
        , June 2026 release (Claude usage, April–May 2026).
      </p>
    </div>
  )
}
