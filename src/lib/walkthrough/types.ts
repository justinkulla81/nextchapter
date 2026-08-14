// Shared types for the guided Resume Walkthrough (Master Build Script
// §13.1) — no server-only dependencies, so both the server page and client
// step components can import these directly.

// The candidate-specific, ordered list of screens for one walkthrough
// session — computed once by buildScreenPlan() (screen-plan.ts) and stored
// verbatim in ResumeWalkthroughSession.stepAnswers.screenPlan so the step
// pointer stays valid even as findings/detections get resolved mid-walk.
export type WalkthroughScreen =
  | { kind: 'overview' }
  | { kind: 'mechanical'; key: string }
  | { kind: 'target-line' }
  | { kind: 'bullet'; workHistoryEntryId: string }
  | { kind: 'reviewer'; reviewerQuestionId: string }
  | { kind: 'thin-entry'; reviewerQuestionId: string }
  | { kind: 'review' }

// Mirrors ReviewerQuestion.resolutionType (schema.prisma) — kept as a
// separate type here so client components don't need to import Prisma's
// generated types.
export type ReviewerResolutionType = 'CORRECTED' | 'NOT_APPLICABLE' | 'LEAVE_AS_IS'

// The candidate's own typed answers to the 2-3 questions that unlock one
// guided bullet (§13.1: "guided extraction, not rewriting") — composed into
// the final bullet via composeBulletFromAnswers (compose-bullet.ts), never
// sent through an LLM.
export interface GuidedBulletAnswers {
  outcome?: string
  scope?: string
  elaboration?: string
}

// The single JSON blob persisted on ResumeWalkthroughSession.stepAnswers —
// same one-blob autosave idiom as Reference.draftAnswers
// (src/app/ref/[token]/actions.ts).
export interface WalkthroughStepAnswers {
  screenPlan?: WalkthroughScreen[]
  mechanicalHandled?: Record<string, 'fixed' | 'skipped'>
  targetLineDone?: boolean
  bulletDrafts?: Record<string, GuidedBulletAnswers>
  bulletsHandled?: Record<string, boolean>
  reviewerHandled?: Record<string, { resolutionType: ReviewerResolutionType }>
}

export type WalkthroughStepAction =
  | 'started'
  | 'fixed'
  | 'dismissed'
  | 'skipped'
