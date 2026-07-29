// lastVerified: 2026-07-29 — course/program URLs churn; re-check before
// merging any Learning-page work built on top of this file.
//
// Single source of truth for partner-vs-included-for-quality labeling
// across every Learning-page content file. Mirrors the Partner/"Included
// for quality" pill pattern already used on InterimListingGrid.tsx — same
// two labels, same idea: Partner means NextChapter has a real (even if
// non-monetary today) affiliate/referral relationship; Included for
// quality means the content is genuinely worth surfacing but we earn
// nothing if a candidate uses it, and the UI says so explicitly.

export type Designation = 'PARTNER' | 'INCLUDED_FOR_QUALITY'

export interface LearningProvider {
  name: string
  designation: Designation
  designationNote: string | null
}

export const LEARNING_PROVIDERS: Record<string, LearningProvider> = {
  coursera: { name: 'Coursera', designation: 'PARTNER', designationNote: null },
  edx: { name: 'edX', designation: 'PARTNER', designationNote: null },
  emeritus: {
    name: 'Emeritus',
    designation: 'INCLUDED_FOR_QUALITY',
    designationNote: 'Not a NextChapter partner — we earn nothing if you enroll.',
  },
  toastmasters: {
    name: 'Toastmasters',
    designation: 'INCLUDED_FOR_QUALITY',
    designationNote: 'No revenue relationship — included because it genuinely works.',
  },
  universityExecEd: {
    name: 'University executive education',
    designation: 'INCLUDED_FOR_QUALITY',
    designationNote: 'No revenue relationship with this program.',
  },
  certificationBody: {
    name: 'Certification body',
    designation: 'INCLUDED_FOR_QUALITY',
    designationNote: 'No revenue relationship with this certifying body.',
  },
  hubspotAcademy: {
    name: 'HubSpot Academy',
    designation: 'INCLUDED_FOR_QUALITY',
    designationNote: 'Free courses, no revenue relationship.',
  },
}

// Shared shape every Learning-page content file below builds arrays of —
// one card per resource. `provider` keys into LEARNING_PROVIDERS above;
// `actionType` is one of the LEARNING_MODULE/LEARNING_CERTIFICATE/
// LEARNING_NEW_TOOL keys in src/lib/weekly/action-effort.ts (kept as a
// plain string here since that module doesn't export a literal union).
export interface LearningResource {
  title: string
  description: string
  url: string
  provider: keyof typeof LEARNING_PROVIDERS
  free: boolean
  actionType: string
}

// Point mapping — all reusing the existing action-effort.ts point scale, no
// new categories. AI Training tiers, business-skills courses, and speaking/
// leadership courses are ordinary modules; certifications and alma-mater
// exec-ed programs are the bigger LEARNING_CERTIFICATE tier; function tools
// and the AI proof-point exercise are the lighter "try a new tool" tier.
export const LEARNING_ACTION_TYPE_BY_CONTENT_KIND = {
  aiTrainingModule: 'LEARNING_MODULE',
  businessSkillsModule: 'LEARNING_MODULE',
  speakingLeadershipModule: 'LEARNING_MODULE',
  certification: 'LEARNING_CERTIFICATE',
  execEdProgram: 'LEARNING_CERTIFICATE',
  functionTool: 'LEARNING_NEW_TOOL',
  aiProofPointExercise: 'LEARNING_NEW_TOOL',
} as const
