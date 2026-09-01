'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { Resume } from '@prisma/client'
import { updateResumeDetails, duplicateResumeAsNewVersion } from '@/app/dashboard/resume/actions'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { Button } from '@/components/ui/button'
import { ResumeViewButton } from '@/components/dashboard/ResumeViewButton'
import { ResumeFeedbackCard } from '@/components/dashboard/ResumeFeedbackCard'
import type { ResumeFeedbackItem } from '@/lib/resume/analyze-resume'
import { cn } from '@/lib/utils'

export interface ResumeVersionItem
  extends Pick<
    Resume,
    'id' | 'fileName' | 'label' | 'description' | 'uploadedAt' | 'atsScore' | 'resultsScore' | 'experienceScore' | 'analysisError'
  > {
  isLatest: boolean
  signedUrl: string | null
  atsFeedback: ResumeFeedbackItem[]
  resultsFeedback: ResumeFeedbackItem[]
  experienceFeedback: ResumeFeedbackItem[]
}

// Minimized, one-row-per-version list — every uploaded resume, newest
// first, each expandable to see its analysis, rename/describe it, or clone
// it as a starting point for a new version. The Resume Fixer lives inside
// the current version's row (not a separate card elsewhere on the page) so
// the flow is: open the resume, see what's wrong, then launch the fixer.
export function ResumeVersionsList({ versions, fromGap }: { versions: ResumeVersionItem[]; fromGap?: string }) {
  // A Market Reality Report gap link lands here with ?fromGap=... — that
  // context (and the current version's issues it refers to) only exists in
  // the DOM once this row is expanded, so the deep link forces it open
  // from the start instead of landing on a collapsed panel.
  const [expandedId, setExpandedId] = useState<string | null>(() =>
    fromGap ? (versions.find((v) => v.isLatest)?.id ?? null) : null
  )

  if (versions.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Your resume{versions.length > 1 ? ' versions' : ''}
      </p>
      <div className="divide-y divide-border rounded-lg border border-border">
        {versions.map((version) => (
          <ResumeVersionRow
            key={version.id}
            version={version}
            isExpanded={expandedId === version.id}
            onToggle={() => setExpandedId((id) => (id === version.id ? null : version.id))}
            fromGap={version.isLatest ? fromGap : undefined}
          />
        ))}
      </div>
    </div>
  )
}

function issueCount(version: ResumeVersionItem): number {
  return version.atsFeedback.length + version.resultsFeedback.length + version.experienceFeedback.length
}

function ResumeStatusLine({ version }: { version: ResumeVersionItem }) {
  if (version.analysisError) {
    return <p className="text-xs text-destructive">Analysis failed</p>
  }
  if (version.atsScore === null) {
    return <p className="text-xs text-muted-foreground">Analyzing…</p>
  }
  const issues = issueCount(version)
  if (issues > 0) {
    return (
      <p className="text-xs font-medium text-amber-700">
        {issues} issue{issues === 1 ? '' : 's'} found
      </p>
    )
  }
  return <p className="text-xs text-success">No issues found</p>
}

function ResumeVersionRow({
  version,
  isExpanded,
  onToggle,
  fromGap,
}: {
  version: ResumeVersionItem
  isExpanded: boolean
  onToggle: () => void
  fromGap?: string
}) {
  const [, startTransition] = useTransition()
  const [dirty, setDirty] = useState(false)

  return (
    <div className={cn('p-3', isExpanded && 'bg-muted/30')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {version.label || version.fileName}
            {version.isLatest && (
              <span className="ml-1.5 rounded-full bg-brand/10 px-1.5 py-0.5 text-[10px] font-medium text-brand">
                Current
              </span>
            )}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {version.description || version.uploadedAt.toLocaleDateString()}
          </p>
          <ResumeStatusLine version={version} />
        </div>
        <div className="flex shrink-0 items-center gap-3 text-xs font-medium">
          {version.signedUrl && (
            <ResumeViewButton
              signedUrl={version.signedUrl}
              title={version.label || version.fileName}
              className="text-primary hover:underline"
            >
              View
            </ResumeViewButton>
          )}
          <button type="button" onClick={onToggle} className="text-muted-foreground hover:text-foreground">
            {isExpanded ? 'Hide' : 'Details'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3 space-y-4">
          <div className="space-y-3">
            {version.analysisError ? (
              <p className="text-sm text-destructive">{version.analysisError}</p>
            ) : version.atsScore === null ? (
              <p className="text-sm text-muted-foreground">Analyzing…</p>
            ) : (
              <>
                {version.atsFeedback.length > 0 && (
                  <div className="space-y-2">
                    {version.atsFeedback.map((item, i) => (
                      <ResumeFeedbackCard key={i} item={item} />
                    ))}
                  </div>
                )}
                {version.resultsFeedback.length > 0 && (
                  <div className="space-y-2">
                    {version.resultsFeedback.map((item, i) => (
                      <ResumeFeedbackCard key={i} item={item} />
                    ))}
                  </div>
                )}
                {version.experienceScore !== null && (
                  <div id={version.isLatest ? 'action-plan' : undefined} className="scroll-mt-4 space-y-2">
                    {fromGap && (
                      <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                        From your Market Reality Report: <span className="italic">&ldquo;{fromGap}&rdquo;</span> — the
                        items below are what to fix on the resume itself.
                      </p>
                    )}
                    {version.experienceFeedback.map((item, i) => (
                      <ResumeFeedbackCard key={i} item={item} />
                    ))}
                  </div>
                )}
                {issueCount(version) === 0 && <p className="text-sm text-muted-foreground">No issues found.</p>}
              </>
            )}
          </div>

          {version.isLatest && (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-background p-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Want us to walk you through fixing it?</p>
                <p className="text-xs text-muted-foreground">
                  The Resume Fixer — a guided, one-issue-at-a-time pass, about 18 minutes. Nothing changes until
                  you approve it.
                </p>
              </div>
              <Button size="sm" nativeButton={false} render={<Link href="/dashboard/resume/walkthrough" />}>
                Open the Resume Fixer
                <ArrowRight className="size-4" aria-hidden data-icon="inline-end" />
              </Button>
            </div>
          )}

          <form action={updateResumeDetails.bind(null, version.id)} className="space-y-2" onChange={() => setDirty(true)}>
            <div className="space-y-1">
              <label htmlFor={`label-${version.id}`} className="text-xs font-medium text-muted-foreground">
                Name
              </label>
              <Input id={`label-${version.id}`} name="label" defaultValue={version.label ?? version.fileName} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <label htmlFor={`description-${version.id}`} className="text-xs font-medium text-muted-foreground">
                Description
              </label>
              <Textarea
                id={`description-${version.id}`}
                name="description"
                defaultValue={version.description ?? ''}
                rows={2}
                placeholder="What's different about this one — e.g. tailored for VP Product roles"
              />
            </div>
            <SubmitButton size="sm" variant={dirty ? 'success' : 'outline'}>
              Save
            </SubmitButton>
          </form>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => startTransition(() => duplicateResumeAsNewVersion(version.id))}
              className="text-xs font-medium text-primary hover:underline"
            >
              Use as starting point for a new version
            </button>
            <Link
              href={`/dashboard/community?tab=messages&relation=peers&attachResumeId=${version.id}`}
              className="text-xs font-medium text-primary hover:underline"
            >
              Send to a contact
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
