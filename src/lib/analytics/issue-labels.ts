// Human-readable labels for the admin-facing (not candidate-facing —
// ISSUE_TAXONOMY entries already carry candidateFacingLabel) IssueCategory
// and IssueSeverity unions from issue-taxonomy.ts. Split into its own file
// rather than added to issue-taxonomy.ts so that file's "no imports from
// anywhere else, stays a leaf" commitment (see its header comment) isn't
// disturbed by admin-only display concerns.

import type { IssueCategory, IssueSeverity } from '@/lib/analytics/issue-taxonomy'

export const ISSUE_CATEGORY_LABELS: Record<IssueCategory, string> = {
  ats_parsing: 'ATS parsing',
  evidence_quality: 'Evidence quality',
  positioning: 'Positioning',
  mechanics: 'Mechanics',
  contactability: 'Contactability',
  reconciliation: 'Reconciliation',
  reviewer_question: 'Reviewer question',
  structure: 'Structure',
}

export const ISSUE_SEVERITY_LABELS: Record<IssueSeverity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}
