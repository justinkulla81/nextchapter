// Shared type + label map for "is this contact already on NextChapter"
// badges — split out from member-lookup.ts (which pulls in server-only DB
// access) so client components like ContactDirectoryTable can import the
// type/labels without dragging server-only code into the client bundle.

export type NextChapterMembership = 'CANDIDATE' | 'COACH' | 'RECRUITER' | 'HIRING_MANAGER'

export const MEMBERSHIP_LABEL: Record<NextChapterMembership, string> = {
  CANDIDATE: 'Candidate',
  COACH: 'Coach',
  RECRUITER: 'Recruiter',
  HIRING_MANAGER: 'Hiring Manager',
}
