import type {
  ProductItemKind, ProductItemStatus, ProductRoadmapBucket, ProductEffort,
  ProductFeedbackSource, ProductFeedbackStatus, ProductCompetitorOverlap,
} from '@prisma/client'

export const KIND_LABELS: Record<ProductItemKind, string> = {
  GOAL: 'Goal', FEATURE: 'Feature', IDEA: 'Idea', QUESTION: 'Question',
  GAP: 'Gap', PRINCIPLE: 'Principle', TODO: 'To-do', BLOCKER: 'Blocker',
}

export const KIND_HINTS: Record<ProductItemKind, string> = {
  GOAL: 'What you are trying to achieve',
  FEATURE: 'Something to build',
  IDEA: 'Unshaped, unjudged',
  QUESTION: 'Something you do not know yet',
  GAP: 'Something missing, often from feedback or a competitor',
  PRINCIPLE: 'A rule you want to hold yourself to',
  TODO: 'A small concrete task',
  BLOCKER: 'A gating issue — cost, a dependency, a decision',
}

export const STATUS_LABELS: Record<ProductItemStatus, string> = {
  SPARK: 'Spark', NEW: 'New', TRIAGED: 'Triaged', PLANNED: 'Planned',
  IN_PROGRESS: 'In progress', SHIPPED: 'Shipped', WONT_DO: 'Not doing',
}

export const BUCKET_LABELS: Record<ProductRoadmapBucket, string> = {
  NOW: 'Now', NEXT: 'Next', LATER: 'Later', UNSCHEDULED: 'Unscheduled',
}

export const EFFORT_LABELS: Record<ProductEffort, string> = {
  S: 'Small', M: 'Medium', L: 'Large', XL: 'Very large', UNKNOWN: 'Unsized',
}

export const SOURCE_LABELS: Record<ProductFeedbackSource, string> = {
  TESTER: 'Tester', CANDIDATE: 'Candidate', COACH: 'Coach', RECRUITER: 'Recruiter',
  EMPLOYER: 'Employer', INVESTOR: 'Investor', ADVISOR: 'Advisor', SELF: 'Me', OTHER: 'Other',
}

export const FEEDBACK_STATUS_LABELS: Record<ProductFeedbackStatus, string> = {
  NEW: 'Not triaged', TRIAGED: 'Linked to an item',
  ADDRESSED: 'They have been told', ARCHIVED: 'Archived',
}

export const OVERLAP_LABELS: Record<ProductCompetitorOverlap, string> = {
  HAS: 'Has it', PARTIAL: 'Partial', NONE: 'Does not', UNKNOWN: 'Not checked',
}

// Red where a competitor HAS a feature, green where they do not: this grid is
// read to find gaps and moats, so the color tracks "is this a problem for us",
// not "is this true".
export const OVERLAP_CLASS: Record<ProductCompetitorOverlap, string> = {
  HAS: 'bg-destructive/10 text-destructive',
  PARTIAL: 'bg-orange/15 text-orange',
  NONE: 'bg-brand/15 text-brand',
  UNKNOWN: 'bg-muted text-muted-foreground',
}

export const KINDS = Object.keys(KIND_LABELS) as ProductItemKind[]
export const STATUSES = Object.keys(STATUS_LABELS) as ProductItemStatus[]
export const BUCKETS = Object.keys(BUCKET_LABELS) as ProductRoadmapBucket[]
export const EFFORTS = Object.keys(EFFORT_LABELS) as ProductEffort[]
export const SOURCES = Object.keys(SOURCE_LABELS) as ProductFeedbackSource[]
export const OVERLAPS = Object.keys(OVERLAP_LABELS) as ProductCompetitorOverlap[]

export function statusClass(s: ProductItemStatus): string {
  switch (s) {
    case 'SPARK': return 'bg-muted text-muted-foreground'
    case 'SHIPPED': return 'bg-brand/15 text-brand'
    case 'WONT_DO': return 'bg-muted text-muted-foreground line-through'
    case 'IN_PROGRESS': return 'bg-orange/15 text-orange'
    default: return 'bg-muted text-foreground'
  }
}

export function formatDate(d: Date | null | undefined): string {
  return d ? d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'
}
