import type {
  ProductItemKind, ProductItemArea, ProductItemStatus, ProductRoadmapBucket, ProductEffort,
  ProductFeedbackSource, ProductFeedbackStatus, ProductCompetitorOverlap,
} from '@prisma/client'

export const KIND_LABELS: Record<ProductItemKind, string> = {
  GOAL: 'Goal', IDEA: 'Idea', QUESTION: 'Question', PRINCIPLE: 'Principle', BLOCKER: 'Blocker',
  FEATURE: 'Feature', BUG: 'Bug', FEEDBACK: 'Feedback', TEXT: 'Text', CONTENT: 'Content',
  GAP: 'Gap', TODO: 'To-do',
}

export const KIND_HINTS: Record<ProductItemKind, string> = {
  GOAL: 'What you are trying to achieve',
  IDEA: 'Unshaped, unjudged',
  QUESTION: 'Something you do not know yet',
  PRINCIPLE: 'A rule you want to hold yourself to',
  BLOCKER: 'A gating issue — cost, a dependency, a decision',
  FEATURE: 'Something to build',
  BUG: 'Something built that is behaving wrongly',
  FEEDBACK: 'What somebody told us about the product',
  TEXT: 'Copy — wording on a screen, an email, a button',
  CONTENT: 'Material the product serves — courses, questions, templates',
  GAP: 'Something missing, often from feedback or a competitor',
  TODO: 'A small concrete task',
}

/**
 * Kinds grouped for the pickers.
 *
 * A flat list of twelve reads as noise; the real split is which side of the
 * business the claim is about — the company, or the thing we ship. GAP and
 * TODO sit outside both on purpose (see the enum's comment), so they get
 * their own group rather than being filed under whichever felt closer.
 */
export const KIND_GROUPS: { label: string; kinds: ProductItemKind[] }[] = [
  { label: 'Company', kinds: ['GOAL', 'IDEA', 'QUESTION', 'PRINCIPLE', 'BLOCKER'] },
  { label: 'Product', kinds: ['FEATURE', 'BUG', 'FEEDBACK', 'TEXT', 'CONTENT'] },
  { label: 'Either', kinds: ['GAP', 'TODO'] },
]

export const AREA_LABELS: Record<ProductItemArea, string> = {
  COMPANY: 'Company', PRODUCT: 'Product', GTM: 'GTM',
  OPERATIONS: 'Operations', FINANCE: 'Finance', LEGAL: 'Legal',
}

export const AREA_HINTS: Record<ProductItemArea, string> = {
  COMPANY: 'The business itself — where it is going, what governs it',
  PRODUCT: 'The thing we ship',
  GTM: 'Getting it in front of people — marketing, sales, partnerships',
  OPERATIONS: 'Running the place — process, tooling, support, hiring',
  FINANCE: 'Money in, money out, runway',
  LEGAL: 'Contracts, terms, privacy, IP',
}

export const AREAS = Object.keys(AREA_LABELS) as ProductItemArea[]

/**
 * Where a kind lands when nobody picks an area.
 *
 * Kind and area are different questions — "hire a fractional CFO" and "fix
 * the parser" are both to-dos — but the Company and Product kind groups do
 * imply their area, and making someone restate it is how a field ends up
 * wrong on half the rows. GTM, Operations, Finance and Legal have no implied
 * kind, so their rows are the ones you set deliberately.
 */
export function defaultAreaForKind(kind: ProductItemKind): ProductItemArea {
  return KIND_GROUPS[0].kinds.includes(kind) ? 'COMPANY' : 'PRODUCT'
}

export function areaClass(area: ProductItemArea): string {
  switch (area) {
    case 'COMPANY': return 'bg-navy/10 text-navy'
    case 'PRODUCT': return 'bg-brand/15 text-brand'
    case 'GTM': return 'bg-orange/15 text-orange'
    default: return 'bg-muted text-muted-foreground'
  }
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
