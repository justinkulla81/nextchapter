// Shared option lists for the NC Job Board 2.0 visibility model — used by
// both submission forms (employer/recruiter share JobBoardSubmissionForm;
// admin has its own ExclusiveJobPostingForm) so the three pickers read
// identically everywhere a posting gets created.

// 'A_LIST_ONLY' is the persisted value (ExclusiveJobPosting.audienceTier) —
// left as-is rather than renamed, since it's never shown to a user and
// renaming a value already written to real rows is a migration, not a copy
// fix. Only the display label needs to say "Candidate+" now.
export const AUDIENCE_TIER_OPTIONS = [
  { value: 'ALL_CANDIDATES' as const, label: 'All candidates' },
  { value: 'A_LIST_ONLY' as const, label: 'Candidate+ only' },
]

export const DISTRIBUTION_OPTIONS = [
  { value: 'OPEN' as const, label: 'Open to everyone eligible' },
  { value: 'TARGETED' as const, label: 'Only candidates who fit' },
]

// Recruiter-only addition — a private mandate that never appears in the
// browse feed at all (admin/pipeline visibility only).
export const DISTRIBUTION_OPTIONS_WITH_EXCLUDED = [
  ...DISTRIBUTION_OPTIONS,
  { value: 'EXCLUDED' as const, label: "Don't show in the board at all" },
]

export const DISCLOSURE_OPTIONS = [
  { value: 'OPEN' as const, label: 'Name the company' },
  { value: 'CONFIDENTIAL' as const, label: 'Keep the company confidential' },
]

export const TARGET_REMOTE_POLICY_OPTIONS = [
  { value: 'onsite' as const, label: 'On-site' },
  { value: 'remote' as const, label: 'Remote' },
  { value: 'hybrid' as const, label: 'Hybrid' },
]
