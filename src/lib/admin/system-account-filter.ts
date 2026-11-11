import 'server-only'
import type { Prisma } from '@prisma/client'

// The one row CandidateProfile.isSystemAccount marks (see
// scripts/create-system-account.ts) authors admin Community posts but is
// not a real candidate — every admin-facing candidate list/count must
// exclude it so it doesn't skew population figures or show up as a row in a
// candidates table. Spread this into any CandidateProfileWhereInput that
// isn't already filtered down to a real-candidate-only condition (e.g.
// requiring a registration timestamp or EEOC field the system account will
// never have).
//
// It also excludes sample data (CandidateProfile.isSampleData). The demo generators (workforce, higher-ed and outplacement
// demos) create hundreds of fictional profiles at once — 538 in October and November 2026, against 78 real members — and
// they are not people, so no member count, rate or list may include them.
export const EXCLUDE_NON_MEMBERS: Prisma.CandidateProfileWhereInput = { isSystemAccount: false, isSampleData: false }

// The older name; same filter. Prefer EXCLUDE_NON_MEMBERS in new code.
export const EXCLUDE_SYSTEM_ACCOUNT = EXCLUDE_NON_MEMBERS
