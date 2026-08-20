'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { Resume } from '@prisma/client'
import { updateResumeDetails, duplicateResumeAsNewVersion } from '@/app/dashboard/resume/actions'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'

export interface ResumeVersionItem extends Pick<Resume, 'id' | 'fileName' | 'label' | 'description' | 'uploadedAt'> {
  isLatest: boolean
  signedUrl: string | null
}

// Minimized, one-row-per-version list — every uploaded resume, newest
// first, each expandable to rename/describe it or clone it as a starting
// point for a new version. Sits right above the upload form so "here's what
// you have" comes before "upload another."
export function ResumeVersionsList({ versions }: { versions: ResumeVersionItem[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

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
          />
        ))}
      </div>
    </div>
  )
}

function ResumeVersionRow({
  version,
  isExpanded,
  onToggle,
}: {
  version: ResumeVersionItem
  isExpanded: boolean
  onToggle: () => void
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
        </div>
        <div className="flex shrink-0 items-center gap-3 text-xs font-medium">
          {version.signedUrl && (
            <a href={version.signedUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              View
            </a>
          )}
          <button type="button" onClick={onToggle} className="text-muted-foreground hover:text-foreground">
            {isExpanded ? 'Hide' : 'Edit'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3 space-y-3">
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
