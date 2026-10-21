import { duplicateLine, postingRepostLine } from '@/lib/jobs/job-status'

// "Reposted · first seen Oct 2, 2026, 3 times" and "Also listed in 2 other places" on a
// job card (job-status.ts). Renders nothing for a role seen once, in one place.
export function RepostNote({
  posting,
}: {
  posting: { repostCount?: number | null; reopenCount?: number | null; repostFirstSeenAt?: Date | null; postedAt?: Date | null; createdAt: Date; duplicateCount?: number | null }
}) {
  const parts = [postingRepostLine(posting), duplicateLine(posting.duplicateCount)].filter(Boolean)
  if (parts.length === 0) return null
  return <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">{parts.join(' · ')}</span>
}
